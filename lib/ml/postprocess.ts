import { getLabel, MODEL_LABELS } from "./labels";
import type { InferenceResult, ModelMetadata } from "./types";

// Used only if the metadata has no threshold; the real value comes from training (model.ts).
export const DEFAULT_UNSURE_THRESHOLD = 0.7;

export function postprocess(output: readonly number[], metadata: ModelMetadata): InferenceResult {
  if (!output.length || output.some((value) => !Number.isFinite(value))) return { status: "error", code: "invalidOutput" };
  if (output.length !== MODEL_LABELS.length) return { status: "error", code: "modelMismatch" };
  const classId = output.indexOf(Math.max(...output)); const label = getLabel(classId);
  if (!label) return { status: "unsupported-class", classId };
  const prediction = { classId, diseaseId: label.diseaseId, disease: label.disease, crop: label.crop, confidence: output[classId], modelVersion: metadata.version };
  // Never present a guess as a diagnosis: other tomato problems and low-confidence results go to an agent.
  if (!label.supported) return { status: "unsure", reason: "other-disease", prediction };
  if (prediction.confidence < (metadata.unsureThreshold ?? DEFAULT_UNSURE_THRESHOLD)) return { status: "unsure", reason: "low-confidence", prediction };
  return { status: "prediction", prediction };
}
