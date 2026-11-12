"""Build the 4-class tomato dataset (early blight, late blight, healthy, other) and split it.

The "other" class is sampled from the remaining PlantVillage tomato diseases so the
model can say "this is a tomato problem I don't give advice for" instead of forcing one
of the three supported diagnoses. Exact-duplicate images are removed before splitting,
so no image can appear in both train and test.
"""
import argparse
import hashlib
import json
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image
from sklearn.model_selection import train_test_split

from common import disease_id, find_class_dirs, image_files, load_config, model_classes, normalize

parser = argparse.ArgumentParser()
parser.add_argument("--source-dir", required=True, help="Folder containing PlantVillage class folders (searched recursively)")
parser.add_argument("--output-dir", required=True)
parser.add_argument("--config", default=str(Path(__file__).with_name("class_config.json")))
args = parser.parse_args()

config = load_config(args.config)
seed = config["split"]["seed"]
targets = config["target_classes"]
other = config["other_class"]
output = Path(args.output_dir)
if output.exists():
    shutil.rmtree(output)

found = find_class_dirs(args.source_dir, targets + other["source_classes"])
missing = [name for name in targets if not found[name]]
if missing:
    raise SystemExit(f"Target classes not found under {args.source_dir}: {missing}. Check the dataset path.")
missing_other = [name for name in other["source_classes"] if not found[name]]
if missing_other:
    print(f"Warning: 'other' source classes not found and skipped: {missing_other}")


def load_records(name):
    records, seen = [], set()
    for directory in found[name]:
        for path in image_files(directory):
            try:
                with Image.open(path) as image:
                    image.verify()
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
            except Exception:
                continue
            if digest in seen:
                continue
            seen.add(digest)
            records.append({"path": path, "source_class": name, "hash": digest})
    return records


records_by_label = {name: load_records(name) for name in targets}
target_counts = sorted(len(rows) for rows in records_by_label.values())
other_budget = other["max_images"] or target_counts[len(target_counts) // 2]

rng = random.Random(seed)
other_pool = {name: load_records(name) for name in other["source_classes"] if found[name]}
for rows in other_pool.values():
    rng.shuffle(rows)
# Round-robin across source diseases so every one is represented evenly.
other_rows, sources = [], [rows for rows in other_pool.values() if rows]
while len(other_rows) < other_budget and sources:
    for rows in list(sources):
        if rows:
            other_rows.append(rows.pop())
            if len(other_rows) >= other_budget:
                break
        else:
            sources.remove(rows)
records_by_label[other["label"]] = other_rows

# Drop any image that appears under two labels (would leak and confuse training).
hash_labels = defaultdict(set)
for label, rows in records_by_label.items():
    for row in rows:
        hash_labels[row["hash"]].add(label)
conflicts = {h for h, labels in hash_labels.items() if len(labels) > 1}

records = []
for label, rows in records_by_label.items():
    for row in rows:
        if row["hash"] not in conflicts:
            records.append({**row, "label": label})

labels = [row["label"] for row in records]
held = config["split"]["validation"] + config["split"]["test"]
train_rows, held_rows = train_test_split(records, test_size=held, random_state=seed, stratify=labels)
valid_rows, test_rows = train_test_split(
    held_rows, test_size=config["split"]["test"] / held, random_state=seed, stratify=[r["label"] for r in held_rows]
)

classes = model_classes(config)
manifest = {"classes": classes, "splits": {}}
for split, rows in {"train": train_rows, "validation": valid_rows, "test": test_rows}.items():
    for label in classes:
        (output / split / label).mkdir(parents=True, exist_ok=True)
    for row in rows:
        # Prefix with the source class so names from different source folders never collide.
        name = f"{normalize(row['source_class'])[:24]}_{row['hash'][:12]}{row['path'].suffix.lower()}"
        shutil.copy2(row["path"], output / split / row["label"] / name)
    manifest["splits"][split] = {
        "by_label": dict(sorted(Counter(r["label"] for r in rows).items())),
        "other_by_source": dict(sorted(Counter(r["source_class"] for r in rows if r["label"] == other["label"]).items())),
    }

mapping = {"classes": [{"class_id": i, "dataset_label": label, "disease_id": disease_id(label)} for i, label in enumerate(classes)]}
(output / "class_mapping.json").write_text(json.dumps(mapping, indent=2) + "\n")
manifest["removed_cross_label_duplicates"] = len(conflicts)
(output / "split_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
