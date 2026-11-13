"""Build the 4-class tomato dataset (early blight, late blight, healthy, other) and split it.

The "other" class holds everything that isn't one of the three supported tomato classes:
the other PlantVillage tomato diseases, potato, other crops and photos without leaves
(groups and shares in class_config.json). The model can then say "not something I give
advice for" instead of forcing one of the three supported diagnoses. Exact-duplicate images are removed before splitting,
so no image can appear in both train and test.

With --field-dir, field photos (PlantDoc train/validation from prepare_field_eval.py) are
added to the train and validation splits. The test split stays PlantVillage-only, so the
lab test number remains comparable between versions.
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

from common import discover_class_dirs, disease_id, image_files, load_config, model_classes, normalize

parser = argparse.ArgumentParser()
parser.add_argument("--source-dir", required=True, help="Folder containing PlantVillage class folders (searched recursively)")
parser.add_argument("--output-dir", required=True)
parser.add_argument("--config", default=str(Path(__file__).with_name("class_config.json")))
parser.add_argument("--field-dir", help="Optional output of prepare_field_eval.py: its train/ and validation/ images are mixed in")
args = parser.parse_args()

config = load_config(args.config)
seed = config["split"]["seed"]
targets = config["target_classes"]
other = config["other_class"]
output = Path(args.output_dir)
if output.exists():
    shutil.rmtree(output)

discovered = discover_class_dirs(args.source_dir)


def dirs_for(name):
    return discovered.get(normalize(name), (name, []))[1]


missing = [name for name in targets if not dirs_for(name)]
if missing:
    raise SystemExit(f"Target classes not found under {args.source_dir}: {missing}. Check the dataset path.")


def load_records(name, dirs):
    records, seen = [], set()
    for directory in dirs:
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


records_by_label = {name: load_records(name, dirs_for(name)) for name in targets}
target_counts = sorted(len(rows) for rows in records_by_label.values())
other_budget = round(other.get("budget_multiplier", 1.0) * target_counts[len(target_counts) // 2])

# Resolve each "other" group to its source folders.
claimed = {normalize(name) for name in targets}
for group in other["groups"]:
    if group["sources"] != "auto":
        claimed |= {normalize(name) for name in group["sources"]}
group_sources = {}
for group in other["groups"]:
    if group["sources"] == "auto":
        names = [display for key, (display, _) in sorted(discovered.items())
                 if "___" in display and not key.startswith("tomato") and key not in claimed]
        names += [name for name in group.get("include", []) if dirs_for(name)]
        for name in group.get("include", []):
            if not dirs_for(name):
                print(f"Warning: '{name}' not found; group '{group['name']}' goes without it.")
    else:
        names = [name for name in group["sources"] if dirs_for(name)]
        for name in group["sources"]:
            if not dirs_for(name):
                print(f"Warning: '{name}' not found; group '{group['name']}' goes without it.")
    group_sources[group["name"]] = names

def lazy_records(name, dirs, rng):
    """Shuffled records for one source, checked and hashed only as they're taken.

    Listing files is cheap; opening and hashing all ~55k PlantVillage photos is slow on
    Kaggle's input disk, and only a few thousand are kept for "other".
    """
    paths = [path for directory in dirs for path in image_files(directory)]
    rng.shuffle(paths)
    seen = set()
    for path in paths:
        try:
            with Image.open(path) as image:
                image.verify()
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
        except Exception:
            continue
        if digest not in seen:
            seen.add(digest)
            yield {"path": path, "source_class": name, "hash": digest}


rng = random.Random(seed)
pools, available = {}, {}
for group in other["groups"]:
    per_source, total = [], 0
    for name in group_sources[group["name"]]:
        dirs = dirs_for(name)
        count = sum(len(image_files(directory)) for directory in dirs)
        if count:
            per_source.append(lazy_records(discovered[normalize(name)][0], dirs, rng))
            total += count
    pools[group["name"]] = per_source
    available[group["name"]] = total

# Split the budget by share; a group that runs short passes its unused budget to the others.
quota = {g["name"]: 0 for g in other["groups"]}
remaining = other_budget
while remaining > 0:
    open_groups = [g for g in other["groups"] if quota[g["name"]] < available[g["name"]]]
    if not open_groups:
        break
    total_share = sum(g["share"] for g in open_groups)
    given = 0
    for g in open_groups:
        extra = min(max(1, round(remaining * g["share"] / total_share)), available[g["name"]] - quota[g["name"]], remaining - given)
        quota[g["name"]] += extra
        given += extra
    remaining -= given
    if given == 0:
        break

other_rows, other_by_group = [], {}
for name, pool in pools.items():
    # Round-robin across a group's sources so every one is represented evenly.
    picked, sources = [], list(pool)
    while len(picked) < quota[name] and sources:
        for rows in list(sources):
            if len(picked) >= quota[name]:
                break
            row = next(rows, None)
            if row is None:
                sources.remove(rows)
            else:
                picked.append(row)
    other_rows += picked
    other_by_group[name] = {"images": len(picked), "sources": group_sources[name]}
print(f"Other budget {other_budget}: " + ", ".join(f"{k} {v['images']}" for k, v in other_by_group.items()))
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
manifest = {"classes": classes, "other_groups": other_by_group, "splits": {}}
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

if args.field_dir:
    # Field photos join train and validation only; field/test stays untouched for evaluation.
    repeat = config["field_eval"].get("train_repeat", 1)
    added = {}
    for split, copies in {"train": repeat, "validation": 1}.items():
        count = Counter()
        for label in classes:
            source_dir = Path(args.field_dir) / split / label
            for path in image_files(source_dir) if source_dir.exists() else []:
                for k in range(copies):
                    shutil.copy2(path, output / split / label / (f"{path.stem}_r{k}{path.suffix}" if copies > 1 else path.name))
                count[label] += 1
        added[split] = dict(sorted(count.items()))
    manifest["field_images_added"] = {"source": args.field_dir, "train_repeat": repeat, "unique_images": added}

mapping = {"classes": [{"class_id": i, "dataset_label": label, "disease_id": disease_id(label)} for i, label in enumerate(classes)]}
(output / "class_mapping.json").write_text(json.dumps(mapping, indent=2) + "\n")
manifest["removed_cross_label_duplicates"] = len(conflicts)
(output / "split_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
