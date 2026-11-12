export type DiseaseLabel = { diseaseId: string; crop: string; disease: string; supported: boolean };
// Must match the class order in public/models/model_metadata.json (alphabetical, as Keras sorts
// folders). tests/critical.test.ts fails if they drift apart. "supported: false" means the app gives
// no treatment advice for that class and routes the farmer to an extension agent instead.
export const MODEL_LABELS: readonly DiseaseLabel[] = [
  { diseaseId: "tomato_early_blight", crop: "Tomato", disease: "Early blight", supported: true },
  { diseaseId: "tomato_late_blight", crop: "Tomato", disease: "Late blight", supported: true },
  { diseaseId: "tomato_healthy", crop: "Tomato", disease: "Healthy", supported: true },
  { diseaseId: "tomato_other", crop: "Tomato", disease: "Other tomato problem", supported: false },
];
export const MODEL_CLASS_LABELS: readonly string[] = ["Tomato___Early_blight", "Tomato___Late_blight", "Tomato___healthy", "Tomato___other"];
export function getLabel(classId: number): DiseaseLabel | undefined { return MODEL_LABELS[classId]; }
