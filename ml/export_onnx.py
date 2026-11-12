"""Export the trained Keras model to ONNX and check it matches Keras on real images."""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

if not hasattr(np, "cast"):  # tf2onnx 1.16 still calls np.cast, removed in NumPy 2.
    class _Cast:
        def __getitem__(self, dtype):
            return lambda value: np.asarray(value, dtype=dtype)
    np.cast = _Cast()

import onnxruntime as ort
import tensorflow as tf
import tf2onnx

parser = argparse.ArgumentParser()
parser.add_argument("--model", required=True, help="model.keras from train.py")
parser.add_argument("--saved-model", help="saved_model folder from train.py (fallback if Keras conversion fails)")
parser.add_argument("--output", required=True)
parser.add_argument("--check-dir", help="Optional image folder (e.g. split/test) to compare Keras and ONNX on real images")
args = parser.parse_args()

model = tf.keras.models.load_model(args.model)
height, width = int(model.inputs[0].shape[1]), int(model.inputs[0].shape[2])
spec = (tf.TensorSpec((None, height, width, 3), tf.float32, name="input"),)
try:
    tf2onnx.convert.from_keras(model, input_signature=spec, output_path=args.output, opset=13)
except Exception as error:
    if not args.saved_model:
        raise
    print(f"Keras conversion failed ({error}); converting the SavedModel instead.")
    subprocess.run([sys.executable, "-m", "tf2onnx.convert", "--saved-model", args.saved_model, "--output", args.output, "--opset", "13"], check=True)

if args.check_dir:
    dataset = tf.keras.utils.image_dataset_from_directory(args.check_dir, image_size=(height, width), batch_size=32, shuffle=False)
    sample = next(iter(dataset.unbatch().batch(64)))[0].numpy().astype(np.float32)
    method = "64 real images compared with the Keras model"
else:
    sample = np.random.default_rng(42).uniform(0, 255, (4, height, width, 3)).astype(np.float32)
    method = "4 random 0-255 tensors compared with the Keras model"

keras_output = model(sample, training=False).numpy()
session = ort.InferenceSession(args.output, providers=["CPUExecutionProvider"])
onnx_output = session.run(None, {session.get_inputs()[0].name: sample})[0]
max_difference = float(np.max(np.abs(keras_output - onnx_output)))
same_class = bool((keras_output.argmax(1) == onnx_output.argmax(1)).all())
if max_difference > 1e-4 or not same_class:
    raise SystemExit(f"ONNX parity check failed: max difference {max_difference}, same top class: {same_class}.")

metadata = {
    "format": "onnx", "onnx_version": "opset-13",
    "input": {"name": session.get_inputs()[0].name, "shape": [None, height, width, 3], "dtype": "float32", "value_range": "0-255"},
    "output": {"shape": [None, int(keras_output.shape[1])], "dtype": "float32"},
    "preprocessing": "Applied inside the model: (pixel / 127.5) - 1",
    "source_model": args.model,
    "size_mb": round(Path(args.output).stat().st_size / 1e6, 2),
    "verification": {"method": method, "max_absolute_difference": max_difference, "same_top_class": same_class, "passed": True},
}
metadata_path = str(Path(args.output).with_suffix("")) + ".onnx.metadata.json"
Path(metadata_path).write_text(json.dumps(metadata, indent=2) + "\n")
print(json.dumps(metadata, indent=2))
