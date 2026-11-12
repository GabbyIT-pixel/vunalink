"""Turn PlantDoc tomato images into field data with the model's 4 classes.

PlantDoc photos come from real fields and the web, not a lab. Its own test folder has
only ~69 tomato images, too few to measure anything, so all PlantDoc tomato images
(train/ and test/ folders) are pooled, exact duplicates removed, and split here:

  field/train       -> mixed into training     (only when prepare_dataset.py gets --field-dir)
  field/validation  -> mixed into validation   (calibration and unsure threshold)
  field/test        -> the field test set; never used for training

Images are re-encoded as RGB JPEG (PlantDoc has some PNG/CMYK files).
PlantDoc is CC BY 4.0: credit "PlantDoc (Singh et al., 2020)" wherever results are shown.
"""
import argparse
import hashlib
import json
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image
from sklearn.model_selection import train_test_split

from common import find_class_dirs, image_files, load_config, model_classes, normalize

parser = argparse.ArgumentParser()
parser.add_argument("--source-dir", required=True, help="PlantDoc root (searched recursively)")
parser.add_argument("--output-dir", required=True)
parser.add_argument("--config", default=str(Path(__file__).with_name("class_config.json")))
args = parser.parse_args()

config = load_config(args.config)
field = config["field_eval"]
class_map, shares, seed = field["class_map"], field["split"], config["split"]["seed"]
output = Path(args.output_dir)
if output.exists():
    shutil.rmtree(output)

found = find_class_dirs(args.source_dir, list(class_map))
missing = [name for name, dirs in found.items() if not dirs]
if missing:
    print(f"Warning: PlantDoc folders not found: {missing}")
if all(not dirs for dirs in found.values()):
    raise SystemExit(f"No PlantDoc tomato folders found under {args.source_dir}.")

rows, seen, skipped = [], set(), 0
for source, dirs in found.items():
    for directory in dirs:
        for path in image_files(directory):
            try:
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                if digest in seen:
                    continue
                with Image.open(path) as image:
                    image.convert("RGB")  # fails here, not later, if the file is unreadable
                seen.add(digest)
                rows.append({"path": path, "source": source, "label": class_map[source], "hash": digest})
            except Exception:
                skipped += 1

# Stratify on the source folder so every PlantDoc disease shows up in each split.
# Sources with too few images to stratify (e.g. 2 spider-mite photos) join the largest
# source with the same label.
source_counts = Counter(r["source"] for r in rows)
largest_for_label = {}
for source, count in source_counts.most_common():
    largest_for_label.setdefault(class_map[source], source)
strata = [r["source"] if source_counts[r["source"]] >= 8 else largest_for_label[r["label"]] for r in rows]
held = shares["validation"] + shares["test"]
train_rows, held_rows, _, held_strata = train_test_split(rows, strata, test_size=held, random_state=seed, stratify=strata)
valid_rows, test_rows = train_test_split(held_rows, test_size=shares["test"] / held, random_state=seed, stratify=held_strata)

summary = {"dataset": field["dataset"], "licence": "CC BY 4.0 (Singh et al., 2020)", "unreadable_skipped": skipped, "splits": {}}
for split, split_rows in {"train": train_rows, "validation": valid_rows, "test": test_rows}.items():
    for label in model_classes(config):
        (output / split / label).mkdir(parents=True, exist_ok=True)
    for row in split_rows:
        with Image.open(row["path"]) as image:
            image.convert("RGB").save(output / split / row["label"] / f"field_{normalize(row['source'])[:24]}_{row['hash'][:12]}.jpg", format="JPEG", quality=95)
    summary["splits"][split] = {
        "by_label": dict(sorted(Counter(r["label"] for r in split_rows).items())),
        "by_source": dict(sorted(Counter(r["source"] for r in split_rows).items())),
    }

(output / "field_manifest.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
