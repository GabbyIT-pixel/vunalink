"""Copy one deterministic held-out test image per class and record the model's scores.

The browser parity test compares its ONNX output on these images with these scores.
"""
import argparse
import json
import shutil
from pathlib import Path

import numpy as np
import tensorflow as tf

from common import image_files

parser = argparse.ArgumentParser()
parser.add_argument("--model", required=True)
parser.add_argument("--metadata", required=True, help="model_metadata.json from train.py")
parser.add_argument("--test-dir", required=True)
parser.add_argument("--output-dir", required=True)
parser.add_argument("--seed", type=int, default=42)
args = parser.parse_args()

metadata = json.loads(Path(args.metadata).read_text())
size = (metadata["input"]["height"], metadata["input"]["width"])
root, output = Path(args.test_dir), Path(args.output_dir)
for old in output.glob("reference_*"):
    old.unlink()
output.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(args.seed)
model = tf.keras.models.load_model(args.model)
rows = []
for class_id, label in enumerate(metadata["classes"]):
    files = image_files(root / label)
    if not files:
        continue
    path = files[int(rng.integers(len(files)))]
    array = tf.keras.utils.img_to_array(tf.keras.utils.load_img(path, target_size=size, interpolation="bilinear"))
    scores = model.predict(np.expand_dims(array, 0), verbose=0)[0]
    target = output / f"reference_{len(rows):03d}{path.suffix.lower()}"
    shutil.copy2(path, target)
    rows.append({"image": target.name, "expectedClass": label, "expectedClassId": class_id,
                 "referencePredictionClassId": int(np.argmax(scores)), "referenceScores": [float(s) for s in scores]})
(output / "references.json").write_text(json.dumps({"model": str(args.model), "model_version": metadata["version"], "seed": args.seed, "images": rows, "note": "Generated from the trained model; not a substitute for field validation."}, indent=2) + "\n")
print(f"Wrote {len(rows)} reference images to {output}")
