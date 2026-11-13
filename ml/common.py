"""Shared helpers for the VunaLink training scripts."""
import json
import re
from pathlib import Path

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
SKIP_DIR_HINTS = ("grayscale", "segmented")


def load_config(path):
    return json.loads(Path(path).read_text())


def model_classes(config):
    """Class order the model is trained with (alphabetical, as Keras sorts folders)."""
    return sorted(config["target_classes"] + [config["other_class"]["label"]])


def normalize(name):
    """Match folder names across PlantVillage copies (TFDS, Kaggle, different underscores)."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def disease_id(label):
    return label.lower().replace("___", "_").replace("(", "").replace(")", "").replace(" ", "_")


def has_images(directory):
    return any(p.suffix.lower() in IMAGE_SUFFIXES for p in directory.iterdir() if p.is_file())


def find_class_dirs(root, wanted):
    """Find folders under root whose normalized name matches one of `wanted`.

    Returns {wanted_name: [dirs]}. Folders under 'grayscale' or 'segmented' variants
    of PlantVillage are skipped so only colour images are used. Several dirs per class
    are allowed (e.g. PlantDoc has train/ and test/).
    """
    keys = {normalize(name): name for name in wanted}
    found = {name: [] for name in wanted}
    for directory in sorted(Path(root).rglob("*")):
        if not directory.is_dir():
            continue
        lowered = str(directory).lower()
        if any(hint in lowered for hint in SKIP_DIR_HINTS):
            continue
        name = keys.get(normalize(directory.name))
        if name and has_images(directory):
            found[name].append(directory)
    return found


def image_files(directory):
    return sorted(p for p in directory.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)


def discover_class_dirs(root):
    """All image folders under root, grouped by normalized folder name: {normalized: (first name seen, [dirs])}.

    Skips grayscale/segmented PlantVillage variants. Used to find "every other crop" without
    hard-coding names, which differ between PlantVillage copies (e.g. Corn___ vs Corn_(maize)___).
    """
    found = {}
    for directory in sorted(Path(root).rglob("*")):
        if not directory.is_dir() or any(hint in str(directory).lower() for hint in SKIP_DIR_HINTS):
            continue
        if has_images(directory):
            name, dirs = found.setdefault(normalize(directory.name), (directory.name, []))
            dirs.append(directory)
    return found
