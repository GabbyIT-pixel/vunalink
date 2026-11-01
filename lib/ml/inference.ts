import { looksLikeLeaf } from "../image/leaf-gate";
import * as ort from "onnxruntime-web";
import { loadModel } from "./model";
import { postprocess } from "./postprocess";
import { imageToModelInput } from "./preprocess";
import type { InferenceResult, ModelMetadata } from "./types";
export async function runInference(image: Blob, metadata: ModelMetadata): Promise<InferenceResult> {
  let session: ort.InferenceSession;
  try { session = await loadModel(); } catch { return { status: "error", message: "The local crop model could not be loaded. Check that the model and offline runtime are available." }; }
  try {
    const shape = metadata.input;
    if (!shape) return { status: "error", message: "The local crop model has no input settings." };
    const prepared = await imageToModelInput(image, { width: shape.width, height: shape.height });
    if (!looksLikeLeaf(prepared.data)) return { status: "unsupported-class", classId: -1 };
    const tensor = new ort.Tensor("float32", prepared.data, [1, shape.height, shape.width, shape.channels]);
    const output = await session.run({ [session.inputNames[0]]: tensor });
    return postprocess(Array.from(output[session.outputNames[0]].data as Float32Array), metadata);
  } catch { return { status: "error", message: "The crop image could not be analyzed locally. Try another image." }; }
}
