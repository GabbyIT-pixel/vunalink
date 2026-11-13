import * as ort from "onnxruntime-web";
import { MODEL_CLASS_LABELS } from "./labels";
import type { ModelStatus } from "./types";
// Keep the runtime assets local so model loading works offline and does not
// depend on a CDN. The explicit filenames also avoid runtime variant lookup
// differences between browsers.
ort.env.wasm.wasmPaths = {
  wasm: "/onnxruntime/ort-wasm-simd-threaded.wasm",
  mjs: "/onnxruntime/ort-wasm-simd-threaded.mjs",
};
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
export const MODEL_PATH = "/models/vunalink-mobilenet-v2.onnx";
// Keep in sync with public/models/model_metadata.json after each retrain ("version" and
// "calibration.unsure_threshold"); tests/critical.test.ts checks this.
export const MODEL_VERSION = "0.4.0";
export const UNSURE_THRESHOLD = 0.95;
export const MODEL_METADATA = { name: "VunaLink MobileNetV2 (tomato)", version: MODEL_VERSION, format: "onnx" as const, input: { width: 224, height: 224, channels: 3 }, trainingDataset: "PlantVillage", labels: MODEL_CLASS_LABELS, unsureThreshold: UNSURE_THRESHOLD };
let sessionPromise: Promise<ort.InferenceSession> | null = null; let status: ModelStatus = "unavailable";
export function getModelStatus(): ModelStatus { return status; }
export function loadModel(): Promise<ort.InferenceSession> { if (!sessionPromise) { status = "loading"; sessionPromise = ort.InferenceSession.create(MODEL_PATH, { executionProviders: ["wasm"] }).then((session) => { status = "ready"; return session; }).catch((error) => { status = "error"; sessionPromise = null; throw error; }); } return sessionPromise; }
