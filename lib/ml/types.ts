export type ModelStatus = "idle" | "loading" | "ready" | "unavailable" | "error";
export type ModelMetadata = { name: string; version: string; format: "onnx"; input?: { width: number; height: number; channels: number }; normalization?: { mean: number[]; standardDeviation: number[] }; labels?: readonly string[]; trainingDataset?: string; unsureThreshold?: number };
export type Prediction = { classId: number; diseaseId: string; disease: string; crop: string; confidence: number; modelVersion: string };
export type UnsureReason = "other-disease" | "low-confidence";
// Error codes instead of sentences, so the scan screen can show them in the user's language.
// The matching text lives in lib/i18n/dictionaries.ts under `scanErrors`.
export type InferenceErrorCode = "modelLoadFailed" | "modelMissingInput" | "analysisFailed" | "invalidOutput" | "modelMismatch";
export type InferenceResult =
  | { status: "prediction"; prediction: Prediction }
  | { status: "unsure"; reason: UnsureReason; prediction: Prediction }
  | { status: "unsupported-class"; classId: number }
  | { status: "error"; code: InferenceErrorCode };
