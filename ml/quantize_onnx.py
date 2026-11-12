"""Optional: INT8-quantize the ONNX model for low-end phones and compare accuracy.

Uses static QDQ quantization calibrated on validation images. Ship the quantized model
only if its accuracy on the test set (and field set) is close to the float model's and
it runs correctly in the browser.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import tensorflow as tf
from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static
from onnxruntime.quantization.shape_inference import quant_pre_process

parser = argparse.ArgumentParser()
parser.add_argument("--model", required=True, help="Float ONNX model")
parser.add_argument("--output", required=True)
parser.add_argument("--calibration-dir", required=True, help="e.g. split/validation")
parser.add_argument("--test-dir", required=True, help="e.g. split/test, or the field set")
parser.add_argument("--classes", required=True, help="model_metadata.json from train.py")
parser.add_argument("--calibration-images", type=int, default=300)
args = parser.parse_args()

classes = json.loads(Path(args.classes).read_text())["classes"]
session = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
height, width = session.get_inputs()[0].shape[1:3]


def images(directory, limit=None, labels=False):
    dataset = tf.keras.utils.image_dataset_from_directory(directory, image_size=(height, width), batch_size=1, class_names=classes, shuffle=True, seed=42)
    for i, (x, y) in enumerate(dataset):
        if limit and i >= limit:
            return
        yield (x.numpy().astype(np.float32), int(y[0])) if labels else x.numpy().astype(np.float32)


class Reader(CalibrationDataReader):
    def __init__(self):
        self.iterator = images(args.calibration_dir, args.calibration_images)

    def get_next(self):
        batch = next(self.iterator, None)
        return None if batch is None else {input_name: batch}


prepared = str(Path(args.output).with_suffix(".pre.onnx"))
quant_pre_process(args.model, prepared, skip_symbolic_shape=True)
quantize_static(prepared, args.output, Reader(), quant_format=QuantFormat.QDQ, activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8, per_channel=True)
Path(prepared).unlink(missing_ok=True)

quantized = ort.InferenceSession(args.output, providers=["CPUExecutionProvider"])
correct = {"float": 0, "int8": 0}; agree = total = 0
for x, y in images(args.test_dir, labels=True):
    a = session.run(None, {input_name: x})[0].argmax()
    b = quantized.run(None, {input_name: x})[0].argmax()
    correct["float"] += int(a == y); correct["int8"] += int(b == y); agree += int(a == b); total += 1

report = {
    "float_size_mb": round(Path(args.model).stat().st_size / 1e6, 2),
    "int8_size_mb": round(Path(args.output).stat().st_size / 1e6, 2),
    "test_images": total,
    "float_accuracy": correct["float"] / total,
    "int8_accuracy": correct["int8"] / total,
    "top_class_agreement": agree / total,
}
Path(str(Path(args.output).with_suffix("")) + ".quantization.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
