export type ModelStatus = "idle" | "loading" | "ready" | "unavailable" | "error";
export type ModelMetadata = { name: string; version: string; format: "onnx"; input?: { width: number; height: number; channels: number }; normalization?: { mean: number[]; standardDeviation: number[] }; labels?: readonly string[]; trainingDataset?: string; unsureThreshold?: number };
export type Prediction = { classId: number; diseaseId: string; disease: string; crop: string; confidence: number; modelVersion: string };
export type UnsureReason = "other-disease" | "low-confidence";
export type InferenceResult =
  | { status: "prediction"; prediction: Prediction }
  | { status: "unsure"; reason: UnsureReason; prediction: Prediction }
  | { status: "unsupported-class"; classId: number }
  | { status: "error"; message: string };
