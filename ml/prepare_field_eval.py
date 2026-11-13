"""Build the field-photo data (real phone/field photos, not lab) with the model's 4 classes.

Sources:
  - PlantDoc (--source-dir): tomato folders plus potato, squash powdery mildew and bell
    pepper (as "other"), mapped by class_map in class_config.json. CC BY 4.0, Singh et al., 2020.
  - Any number of extra datasets (--extra-dir, repeatable): a folder with one subfolder
    per class, e.g. a public field dataset or your own labelled farm photos. Subfolders
    are labelled by keyword (field_eval.extra_rules in class_config.json): a name with
    "early blight" -> early blight, "late blight" -> late blight, "healthy" -> healthy,
    anything else -> other. Check the printed mapping before training.

Each dataset is deduplicated and split on its own, 60/15/25, stratified by folder, so
adding a dataset never reshuffles another dataset's test photos:

  field/train       -> mixed into training     (only when prepare_dataset.py gets --field-dir)
  field/validation  -> mixed into validation   (calibration and unsure threshold)
  field/test        -> the field test set; never used for training

Files are named field_<dataset>__<folder>_<hash>.jpg, so training can repeat datasets by
different amounts and evaluation can report results per dataset. Images are re-encoded
as RGB JPEG; extra datasets are also shrunk to at most 640 px (the model sees 224 px).
"""
import argparse
import hashlib
import json
import random
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image
from sklearn.model_selection import train_test_split

from common import discover_class_dirs, find_class_dirs, image_files, load_config, model_classes, normalize

parser = argparse.ArgumentParser()
parser.add_argument("--source-dir", required=True, help="PlantDoc root (searched recursively)")
parser.add_argument("--extra-dir", action="append", default=[],
                    help="Extra labelled field photos: a folder with one subfolder per class. Repeat for several.")
parser.add_argument("--output-dir", required=True)
parser.add_argument("--config", default=str(Path(__file__).with_name("class_config.json")))
args = parser.parse_args()

config = load_config(args.config)
field = config["field_eval"]
class_map, shares, seed = field["class_map"], field["split"], config["split"]["seed"]
rules, unmatched_label = field["extra_rules"]["rules"], field["extra_rules"]["unmatched"]
skip_words = [normalize(word) for word in field["extra_rules"].get("skip_folders", [])]
output = Path(args.output_dir)
if output.exists():
    shutil.rmtree(output)


def read_rows(dataset, folders, seen):
    """folders: [(folder name, label, [dirs])] -> deduplicated rows; also returns unreadable count."""
    rows, skipped = [], 0
    for folder, label, dirs in folders:
        for directory in dirs:
            for path in image_files(directory):
                try:
                    digest = hashlib.sha256(path.read_bytes()).hexdigest()
                    if digest in seen:
                        continue
                    with Image.open(path) as image:
                        image.convert("RGB")  # fails here, not later, if the file is unreadable
                    seen.add(digest)
                    rows.append({"path": path, "dataset": dataset, "source": folder, "label": label, "hash": digest})
                except Exception:
                    skipped += 1
    return rows, skipped


def split_rows(rows):
    """60/15/25 split stratified by folder; folders too small to stratify join the largest folder with that label."""
    counts = Counter(r["source"] for r in rows)
    largest_for_label = {}
    for source, _ in counts.most_common():
        largest_for_label.setdefault(next(r["label"] for r in rows if r["source"] == source), source)
    strata = [r["source"] if counts[r["source"]] >= 8 else largest_for_label[r["label"]] for r in rows]
    held = shares["validation"] + shares["test"]
    try:
        train, rest, _, rest_strata = train_test_split(rows, strata, test_size=held, random_state=seed, stratify=strata)
        valid, test = train_test_split(rest, test_size=shares["test"] / held, random_state=seed, stratify=rest_strata)
        return {"train": train, "validation": valid, "test": test}
    except ValueError:
        # Some folder is too small for sklearn's stratified split (e.g. 3 photos). Split each folder by hand:
        # rounded shares, at least one test photo when a folder has 3 or more, the rest to training.
        print("Note: small folders; splitting each folder by hand.")
        rng = random.Random(seed)
        parts = {"train": [], "validation": [], "test": []}
        for stratum in sorted(set(strata)):
            members = [r for r, s in zip(rows, strata) if s == stratum]
            rng.shuffle(members)
            n = len(members)
            n_test = max(round(n * shares["test"]), 1 if n >= 3 else 0)
            n_valid = round(n * shares["validation"]) if n - n_test >= 3 else 0
            parts["test"] += members[:n_test]
            parts["validation"] += members[n_test:n_test + n_valid]
            parts["train"] += members[n_test + n_valid:]
        return parts


def label_for(folder):
    key = normalize(folder)
    for rule in rules:
        if any(normalize(word) in key for word in rule["match"]):
            return rule["label"]
    return unmatched_label


seen = set()
datasets = []

# PlantDoc, mapped folder by folder.
found = find_class_dirs(args.source_dir, list(class_map))
missing = [name for name, dirs in found.items() if not dirs]
if missing:
    print(f"Warning: PlantDoc folders not found: {missing}")
if all(not dirs for dirs in found.values()):
    raise SystemExit(f"No PlantDoc tomato folders found under {args.source_dir}.")
rows, skipped = read_rows("plantdoc", [(name, class_map[name], dirs) for name, dirs in found.items() if dirs], seen)
datasets.append({"name": "plantdoc", "root": args.source_dir, "rows": rows, "skipped": skipped, "resize": False,
                 "mapping": {name: class_map[name] for name, dirs in found.items() if dirs}})

# Extra datasets, labelled by keyword.
for root in args.extra_dir:
    name = normalize(Path(root).name)[:16] or "extra"
    while name in {d["name"] for d in datasets}:
        name += "x"
    folders = []
    for key, (folder, dirs) in sorted(discover_class_dirs(root).items()):
        if key in {"train", "test", "val", "valid", "validation", "images"}:
            print(f"Note: skipping folder '{folder}' in {root} (not a class folder).")
            continue
        # Skip augmented copies wherever they sit (e.g. "Augmented Dataset/Early Blight"):
        # they are edited copies of the originals and would leak test photos into training.
        kept = [d for d in dirs if not any(word in normalize(part) for part in Path(d).relative_to(root).parts for word in skip_words)]
        for d in dirs:
            if d not in kept:
                print(f"Note: skipping '{Path(d).relative_to(root)}' (augmented copies).")
        if kept:
            folders.append((folder, label_for(folder), kept))
    labels = {label for _, label, _ in folders}
    if not labels - {unmatched_label}:
        raise SystemExit(f"{root}: no folder name matched early blight, late blight or healthy. "
                         f"Folders found: {[f for f, _, _ in folders]}. Rename them or extend field_eval.extra_rules.")
    rows, skipped = read_rows(name, folders, seen)
    datasets.append({"name": name, "root": root, "rows": rows, "skipped": skipped, "resize": True,
                     "mapping": {folder: label for folder, label, _ in folders}})

summary = {"datasets": {}, "splits": {}}
for split in ("train", "validation", "test"):
    for label in model_classes(config):
        (output / split / label).mkdir(parents=True, exist_ok=True)

totals = {split: Counter() for split in ("train", "validation", "test")}
for dataset in datasets:
    print(f"\n{dataset['name']} ({dataset['root']}): folder -> label")
    for folder, label in dataset["mapping"].items():
        print(f"  {folder!r:45} -> {label}")
    if not dataset["rows"]:
        print("  Warning: no readable images; skipped.")
        continue
    parts = split_rows(dataset["rows"])
    info = {"mapping": dataset["mapping"], "unreadable_skipped": dataset["skipped"], "splits": {}}
    for split, split_rows_ in parts.items():
        for row in split_rows_:
            with Image.open(row["path"]) as image:
                image = image.convert("RGB")
                if dataset["resize"]:
                    image.thumbnail((640, 640))
                stem = f"field_{dataset['name']}__{normalize(row['source'])[:24]}_{row['hash'][:12]}"
                image.save(output / split / row["label"] / f"{stem}.jpg", format="JPEG", quality=95)
        info["splits"][split] = dict(sorted(Counter(r["label"] for r in split_rows_).items()))
        totals[split].update(r["label"] for r in split_rows_)
    summary["datasets"][dataset["name"]] = info
summary["splits"] = {split: dict(sorted(counter.items())) for split, counter in totals.items()}
summary["licences"] = "PlantDoc: CC BY 4.0 (Singh et al., 2020). Credit any extra public dataset per its own licence."

(output / "field_manifest.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
