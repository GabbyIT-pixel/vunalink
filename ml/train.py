"""Train the 4-class tomato MobileNetV2 model and record everything the app needs.

Phases:
  1. Train the new classification head on a frozen ImageNet MobileNetV2.
  2. Fine-tune the top `fine_tune_layers` of MobileNetV2 with a small learning rate.
  3. Temperature-scale on the validation split so confidence scores are calibrated,
     and fold the temperature into the final Dense layer (the exported model outputs
     calibrated probabilities directly, so the app needs no extra maths).
  4. Choose the "unsure, ask an agent" threshold on validation data.
  5. Evaluate on the held-out PlantVillage test split.
"""
import argparse
import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import tensorflow as tf

from common import disease_id, load_config, model_classes
from evaluate import evaluate_model

parser = argparse.ArgumentParser()
parser.add_argument("--data-dir", required=True, help="Output of prepare_dataset.py")
parser.add_argument("--output-dir", required=True)
parser.add_argument("--config", default=str(Path(__file__).with_name("class_config.json")))
parser.add_argument("--version", default="0.2.0")
parser.add_argument("--weights", default="imagenet", help="Use 'none' only for quick smoke tests")
args = parser.parse_args()

config = load_config(args.config)
mc, calib = config["model"], config["calibration"]
seed = config["split"]["seed"]
random.seed(seed); np.random.seed(seed); tf.random.set_seed(seed)

class_names = model_classes(config)
other_label = config["other_class"]["label"]
other_id = class_names.index(other_label)
size = (mc["input_height"], mc["input_width"])
output = Path(args.output_dir)
output.mkdir(parents=True, exist_ok=True)


def load(split, shuffle):
    dataset = tf.keras.utils.image_dataset_from_directory(
        os.path.join(args.data_dir, split), image_size=size, batch_size=mc["batch_size"],
        label_mode="int", class_names=class_names, shuffle=shuffle, seed=seed,
    )
    return dataset.prefetch(tf.data.AUTOTUNE), dataset.file_paths


(train, _), (valid, valid_paths) = load("train", True), load("validation", False)
# Field photos (from prepare_field_eval.py) are named field_*; the threshold is chosen on them when there are enough.
valid_is_field = np.array([os.path.basename(path).startswith("field_") for path in valid_paths])

# Class weights: inverse frequency, so the smallest class is not ignored.
counts = np.array([len(os.listdir(os.path.join(args.data_dir, "train", name))) for name in class_names])
class_weight = {i: float(counts.sum() / (len(counts) * c)) for i, c in enumerate(counts) if c}
print("Train counts:", dict(zip(class_names, counts.tolist())), "class weights:", class_weight)

# Augmentation aimed at phone photos in the field: framing, light and colour changes.
augment_layers = [
    tf.keras.layers.RandomFlip("horizontal_and_vertical"),
    tf.keras.layers.RandomRotation(0.15),
    tf.keras.layers.RandomZoom((-0.2, 0.2)),
    tf.keras.layers.RandomTranslation(0.1, 0.1),
    tf.keras.layers.RandomBrightness(0.25, value_range=(0, 255)),
    tf.keras.layers.RandomContrast(0.3),
]
# Phone photos are often slightly blurred and differently coloured; newer Keras versions have layers for that.
if hasattr(tf.keras.layers, "RandomSaturation"):
    augment_layers.append(tf.keras.layers.RandomSaturation((0.35, 0.65), value_range=(0, 255)))  # 0.5 = unchanged
if hasattr(tf.keras.layers, "RandomGaussianBlur"):
    augment_layers.append(tf.keras.layers.RandomGaussianBlur(factor=0.5, kernel_size=3, value_range=(0, 255)))
augment = tf.keras.Sequential(augment_layers, name="augmentation")
print("Augmentation:", [layer.__class__.__name__ for layer in augment_layers])

weights = None if args.weights.lower() == "none" else args.weights
base = tf.keras.applications.MobileNetV2(input_shape=(*size, 3), include_top=False, weights=weights)
base.trainable = False
pool = tf.keras.layers.GlobalAveragePooling2D()
dropout = tf.keras.layers.Dropout(0.2)
classifier = tf.keras.layers.Dense(len(class_names), activation="softmax", name="classifier")


def head(image):
    x = tf.keras.applications.mobilenet_v2.preprocess_input(image)
    x = base(x, training=False)  # keeps BatchNorm in inference mode during fine-tuning too
    return classifier(dropout(pool(x)))


inputs = tf.keras.Input(shape=(*size, 3), name="image")
model = tf.keras.Model(inputs, head(augment(inputs)), name="vunalink_train")
# Same layers and weights, without augmentation: this is what gets calibrated, saved and exported,
# so the ONNX file contains no random ops.
inference_inputs = tf.keras.Input(shape=(*size, 3), name="image")
inference_model = tf.keras.Model(inference_inputs, head(inference_inputs), name="vunalink")


def callbacks():
    return [tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=mc["early_stopping_patience"], restore_best_weights=True)]


print("Phase 1: training the classification head")
model.compile(optimizer=tf.keras.optimizers.Adam(mc["learning_rate"]), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
head_history = model.fit(train, validation_data=valid, epochs=mc["epochs"], class_weight=class_weight, callbacks=callbacks())

fine_history = None
if mc["fine_tune_epochs"] > 0 and mc["fine_tune_layers"] > 0:
    print(f"Phase 2: fine-tuning the top {mc['fine_tune_layers']} MobileNetV2 layers")
    base.trainable = True
    for layer in base.layers[:-mc["fine_tune_layers"]]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False
    model.compile(optimizer=tf.keras.optimizers.Adam(mc["fine_tune_learning_rate"]), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    fine_history = model.fit(train, validation_data=valid, epochs=mc["fine_tune_epochs"], class_weight=class_weight, callbacks=callbacks())

print("Phase 3: temperature scaling on the validation split")
valid_labels = np.concatenate([y.numpy() for _, y in valid])
valid_probs = inference_model.predict(valid, verbose=0)
log_probs = np.log(np.clip(valid_probs, 1e-12, 1.0))  # equal to the logits up to a per-row constant


def nll(temperature):
    scaled = log_probs / temperature
    scaled -= scaled.max(axis=1, keepdims=True)
    log_softmax = scaled - np.log(np.exp(scaled).sum(axis=1, keepdims=True))
    return float(-log_softmax[np.arange(len(valid_labels)), valid_labels].mean())


grid = np.exp(np.linspace(np.log(0.25), np.log(10.0), 400))
temperature = float(grid[np.argmin([nll(t) for t in grid])])
print(f"Temperature {temperature:.3f}: validation NLL {nll(1.0):.4f} -> {nll(temperature):.4f}")

# Softmax(logits / T) == a Dense layer whose kernel and bias are divided by T.
kernel, bias = classifier.get_weights()
classifier.set_weights([kernel / temperature, bias / temperature])
calibrated_probs = inference_model.predict(valid, verbose=0)

print("Phase 4: choosing the unsure threshold")
predictions, confidence = calibrated_probs.argmax(axis=1), calibrated_probs.max(axis=1)


def lowest_threshold(mask, target, ceiling):
    """Lowest threshold at which answered predictions in `mask` reach `target` accuracy, else `ceiling`."""
    for candidate in np.arange(calib["min_threshold"], ceiling + 0.001, 0.01):
        answered = mask & (predictions != other_id) & (confidence >= candidate)
        if answered.any() and (predictions[answered] == valid_labels[answered]).mean() >= target:
            return float(round(candidate, 2)), True
    return ceiling, False


lab_threshold, lab_reached = lowest_threshold(~valid_is_field, calib["target_answered_accuracy"], 0.99)
threshold, threshold_source = lab_threshold, "lab validation photos"
field_threshold = None
if valid_is_field.sum() >= calib["min_field_images"]:
    # Field photos are harder, so they get their own (lower) accuracy target; the stricter threshold wins.
    field_threshold, field_reached = lowest_threshold(valid_is_field, calib["field_target_answered_accuracy"], calib["max_threshold"])
    if not field_reached:
        print(f"Warning: field target not reached on {valid_is_field.sum()} field validation photos; using {field_threshold}.")
    if field_threshold > threshold:
        threshold, threshold_source = field_threshold, f"{int(valid_is_field.sum())} field validation photos"
print(f"Unsure threshold: {threshold} (from {threshold_source}; lab {lab_threshold}, field {field_threshold})")

inference_model.save(output / "model.keras")
inference_model.export(output / "saved_model")

mapping = {"classes": [{"class_id": i, "dataset_label": label, "disease_id": disease_id(label)} for i, label in enumerate(class_names)]}
(output / "class_mapping.json").write_text(json.dumps(mapping, indent=2) + "\n")

print("Phase 5: evaluating on the held-out PlantVillage test split")
evaluation = evaluate_model(inference_model, os.path.join(args.data_dir, "test"), class_names, other_label, size, mc["batch_size"], threshold, "PlantVillage", output / "evaluation.json")
print(json.dumps({"metrics": evaluation["metrics"], "unsure_routing": evaluation["unsure_routing"]}, indent=2))


def history(h):
    return None if h is None else {"epochs_run": len(h.history["loss"]), "best_val_loss": float(min(h.history["val_loss"])), "best_val_accuracy": float(max(h.history["val_accuracy"]))}


metadata = {
    "name": "VunaLink MobileNetV2 (tomato)",
    "version": args.version,
    "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "format": "keras",
    "dataset": "PlantVillage",
    "crop": "tomato",
    "class_count": len(class_names),
    "classes": class_names,
    "other_class": other_label,
    "class_mapping": "class_mapping.json",
    "input": {"width": size[1], "height": size[0], "channels": 3, "dtype": "float32", "color_format": "RGB", "tensor_layout": "NHWC", "value_range": "0-255"},
    "preprocessing": {"scaling": "mobilenet_v2.preprocess_input", "formula": "(pixel / 127.5) - 1", "applied_in_model": True},
    "output": {"shape": [None, len(class_names)], "dtype": "float32", "semantics": "temperature-calibrated softmax class probabilities"},
    "calibration": {
        "method": "temperature scaling on validation split, folded into the classifier layer",
        "temperature": temperature,
        "unsure_threshold": threshold,
        "threshold_source": threshold_source,
        "lab_threshold": lab_threshold,
        "field_threshold": field_threshold,
        "unsure_rule": f"ask an agent if the top class is '{other_label}' or its probability is below unsure_threshold",
        "target_answered_accuracy": calib["target_answered_accuracy"],
        "note": calib["note"],
    },
    "training": {**mc, "weights": args.weights, "train_counts": dict(zip(class_names, counts.tolist())), "class_weight": {class_names[i]: w for i, w in class_weight.items()}, "head": history(head_history), "fine_tune": history(fine_history)},
}
(output / "model_metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
print(f"Saved model, metadata and evaluation to {output}")
