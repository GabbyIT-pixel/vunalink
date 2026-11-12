"""Evaluate the classifier, including the "unsure, ask an agent" behaviour.

A prediction is *answered* only if its class is one of the supported diseases (not
"other") and its confidence is at or above the unsure threshold. Everything else is
routed to an extension agent. The report shows both plain classification metrics and
how the routing behaves, plus a threshold sweep for choosing the threshold.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support

from common import load_config


def load_split(directory, class_names, image_size, batch_size):
    return tf.keras.utils.image_dataset_from_directory(
        directory, image_size=image_size, batch_size=batch_size, label_mode="int",
        class_names=class_names, shuffle=False,
    )


def routing_metrics(labels, probabilities, other_id, threshold):
    predictions = probabilities.argmax(axis=1)
    confidence = probabilities.max(axis=1)
    answered = (predictions != other_id) & (confidence >= threshold)
    true_other = labels == other_id
    return {
        "threshold": round(float(threshold), 4),
        "answered_share": float(answered.mean()),
        "answered_accuracy": float((predictions[answered] == labels[answered]).mean()) if answered.any() else None,
        "routed_to_agent_share": float((~answered).mean()),
        "other_routed_to_agent": float((~answered[true_other]).mean()) if true_other.any() else None,
        "supported_wrongly_answered": int((answered & (predictions != labels)).sum()),
    }


def evaluate_probabilities(labels, probabilities, class_names, other_id, threshold, dataset_name):
    predictions = probabilities.argmax(axis=1)
    precision, recall, f1, support = precision_recall_fscore_support(
        labels, predictions, labels=range(len(class_names)), zero_division=0
    )
    present = support > 0
    return {
        "dataset": dataset_name,
        "image_count": int(len(labels)),
        "metrics": {
            "accuracy": float(accuracy_score(labels, predictions)),
            "precision_macro": float(precision[present].mean()),
            "recall_macro": float(recall[present].mean()),
            "f1_macro": float(f1[present].mean()),
        },
        "per_class": [
            {"class_id": i, "label": name, "precision": float(precision[i]), "recall": float(recall[i]),
             "f1": float(f1[i]), "support": int(support[i])}
            for i, name in enumerate(class_names)
        ],
        "confusion_matrix": confusion_matrix(labels, predictions, labels=range(len(class_names))).tolist(),
        "poorest_by_f1": [class_names[i] for i in np.argsort(f1) if present[i]],
        "unsure_routing": routing_metrics(labels, probabilities, other_id, threshold),
        "threshold_sweep": [routing_metrics(labels, probabilities, other_id, t) for t in np.arange(0.5, 0.96, 0.05)],
    }


def evaluate_model(model, directory, class_names, other_label, image_size, batch_size, threshold, dataset_name, output_path=None):
    dataset = load_split(directory, class_names, image_size, batch_size)
    labels = np.concatenate([y.numpy() for _, y in dataset])
    probabilities = model.predict(dataset, verbose=0)
    result = evaluate_probabilities(labels, probabilities, class_names, class_names.index(other_label), threshold, dataset_name)
    if dataset_name == "PlantVillage":
        result["note"] = "PlantVillage test metrics are lab images and do not represent Rwanda field accuracy."
    if output_path:
        Path(output_path).write_text(json.dumps(result, indent=2) + "\n")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate a trained model on a folder of class subfolders.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--data-dir", required=True, help="Folder with one subfolder per class (e.g. split/test or the field set)")
    parser.add_argument("--metadata", required=True, help="model_metadata.json written by train.py (gives classes and threshold)")
    parser.add_argument("--dataset-name", default="PlantDoc")
    parser.add_argument("--output", required=True)
    parser.add_argument("--config", default=str(Path(__file__).with_name("class_config.json")))
    args = parser.parse_args()
    metadata = json.loads(Path(args.metadata).read_text())
    config = load_config(args.config)
    size = (metadata["input"]["height"], metadata["input"]["width"])
    result = evaluate_model(
        tf.keras.models.load_model(args.model), args.data_dir, metadata["classes"], config["other_class"]["label"],
        size, config["model"]["batch_size"], metadata["calibration"]["unsure_threshold"], args.dataset_name, args.output,
    )
    print(json.dumps({"metrics": result["metrics"], "unsure_routing": result["unsure_routing"]}, indent=2))
