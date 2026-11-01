import { MODEL_LABELS, getLabel } from "./labels";
import type { InferenceResult, ModelMetadata } from "./types";

// This build only supports one crop.
const TARGET_CROP = "Tomato";
// Provisional cutoff, not a measured value. Tune it on test images.
const MIN_TARGET_CROP_PROBABILITY = 0.8;

export function postprocess(output: readonly number[], metadata: ModelMetadata): InferenceResult {
  if (!output.length || output.some((value) => !Number.isFinite(value))) {
    return { status: "error", message: "The model returned an invalid result." };
  }

  // Which output positions belong to tomato (3, 4, 5 with the current model).
  const targetIds = MODEL_LABELS
    .map((label, index) => (label.crop === TARGET_CROP ? index : -1))
    .filter((index) => index >= 0);
  if (!targetIds.length) {
    return { status: "error", message: "No supported crop is configured." };
  }

  // The overall top class, used only when we reject the image.
  const overallTop = output.indexOf(Math.max(...output));

  // Total probability the model gives to tomato classes.
  const targetProbability = targetIds.reduce((sum, id) => sum + (output[id] ?? 0), 0);
  if (targetProbability < MIN_TARGET_CROP_PROBABILITY) {
    return { status: "unsupported-class", classId: overallTop };
  }

  // Best tomato class.
  const classId = targetIds.reduce((best, id) => (output[id] > output[best] ? id : best), targetIds[0]);
  const label = getLabel(classId);
  if (!label) return { status: "unsupported-class", classId };

  return {
    status: "prediction",
    prediction: {
      classId,
      diseaseId: label.diseaseId,
      disease: label.disease,
      crop: label.crop,
      confidence: output[classId],
      modelVersion: metadata.version,
    },
  };
}
