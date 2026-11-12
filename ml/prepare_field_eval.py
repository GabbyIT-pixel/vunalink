"""Turn PlantDoc tomato images into a field test set with the model's 4 classes.

PlantDoc photos come from real fields and the web, not a lab, so this measures the
lab-to-field gap the proposal talks about. None of these images are used for training.
Images are re-encoded as RGB JPEG (PlantDoc has some PNG/CMYK files) and exact
duplicates are removed.
"""
import argparse
import hashlib
import json
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image

from common import find_class_dirs, image_files, load_config, model_classes, normalize

parser = argparse.ArgumentParser()
parser.add_argument("--source-dir", required=True, help="PlantDoc root (searched recursively; train/ and test/ are both used)")
parser.add_argument("--output-dir", required=True)
parser.add_argument("--config", default=str(Path(__file__).with_name("class_config.json")))
args = parser.parse_args()

config = load_config(args.config)
class_map = config["field_eval"]["class_map"]
output = Path(args.output_dir)
if output.exists():
    shutil.rmtree(output)
for label in model_classes(config):
    (output / label).mkdir(parents=True, exist_ok=True)

found = find_class_dirs(args.source_dir, list(class_map))
missing = [name for name, dirs in found.items() if not dirs]
if missing:
    print(f"Warning: PlantDoc folders not found: {missing}")
if all(not dirs for dirs in found.values()):
    raise SystemExit(f"No PlantDoc tomato folders found under {args.source_dir}.")

seen, counts, by_source, skipped = set(), Counter(), Counter(), 0
for source, dirs in found.items():
    label = class_map[source]
    for directory in dirs:
        for path in image_files(directory):
            try:
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                if digest in seen:
                    continue
                with Image.open(path) as image:
                    rgb = image.convert("RGB")
                seen.add(digest)
                rgb.save(output / label / f"{normalize(source)[:24]}_{digest[:12]}.jpg", format="JPEG", quality=95)
                counts[label] += 1
                by_source[source] += 1
            except Exception:
                skipped += 1

summary = {"dataset": config["field_eval"]["dataset"], "by_label": dict(sorted(counts.items())), "by_source": dict(sorted(by_source.items())), "unreadable_skipped": skipped}
(output / "field_manifest.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
