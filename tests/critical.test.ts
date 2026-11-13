import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDiseaseInfoRw, getUnsureInfo } from "@/lib/localization/disease-info";
import { MODEL_CLASS_LABELS, MODEL_LABELS } from "@/lib/ml/labels";
import { MODEL_METADATA } from "@/lib/ml/model";
import { postprocess } from "@/lib/ml/postprocess";
import { getRecommendation } from "@/lib/recommendations/knowledge-base";
import { clearDiagnoses, getDiagnoses, saveDiagnosis } from "@/lib/history/storage";
import { validateImageFile } from "@/lib/image/validation";
import { DICTIONARIES, SUPPORTED_LANGUAGES, isSupportedLanguage } from "@/lib/i18n/dictionaries";

const metadata = { name: "test", version: "0.2.0", format: "onnx" as const, unsureThreshold: 0.7 };

describe("critical offline behavior", () => {
  it("validates image selection, type, and size", () => {
    expect(validateImageFile()).toBe("noImage");
    expect(validateImageFile({ type: "image/gif", size: 10 })).toBe("unsupportedType");
    expect(validateImageFile({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toBe("tooLarge");
    expect(validateImageFile({ type: "image/jpeg", size: 100 })).toBeNull();
  });

  it("has a non-empty label for every screen text in every language", () => {
    // Collect every string in a dictionary as "section.key" -> text, so a failure names the blank key.
    const flattenDictionary = (value: unknown, path = ""): [string, unknown][] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) => flattenDictionary(child, path ? `${path}.${key}` : key))
        : [[path, value]];

    for (const language of SUPPORTED_LANGUAGES) {
      for (const [key, text] of flattenDictionary(DICTIONARIES[language])) {
        expect(typeof text === "string" && text.trim().length > 0, `${language}: ${key}`).toBe(true);
      }
    }
  });

  it("only accepts supported languages from storage", () => {
    expect(isSupportedLanguage("rw")).toBe(true);
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
  });

  it("maps the highest model output index to the correct disease", () => {
    expect(postprocess([0.05, 0.9, 0.03, 0.02], metadata)).toMatchObject({ status: "prediction", prediction: { classId: 1, diseaseId: "tomato_late_blight", crop: "Tomato" } });
    expect(postprocess([0.85, 0.1, 0.03, 0.02], metadata)).toMatchObject({ status: "prediction", prediction: { classId: 0, diseaseId: "tomato_early_blight" } });
  });

  it("routes other tomato problems to an agent, even when confident", () => {
    expect(postprocess([0.02, 0.03, 0.05, 0.9], metadata)).toMatchObject({ status: "unsure", reason: "other-disease", prediction: { diseaseId: "tomato_other" } });
  });

  it("routes low-confidence results to an agent instead of diagnosing", () => {
    expect(postprocess([0.5, 0.3, 0.1, 0.1], metadata)).toMatchObject({ status: "unsure", reason: "low-confidence", prediction: { diseaseId: "tomato_early_blight" } });
    expect(postprocess([0.7, 0.2, 0.05, 0.05], metadata)).toMatchObject({ status: "prediction" });
  });

  it("refuses to diagnose with a model that has a different number of classes", () => {
    expect(postprocess([0.01, 0.02, 0.03, 0.8, 0.1, 0.04], metadata)).toMatchObject({ status: "error", code: "modelMismatch" });
  });

  it("has unsure guidance in both languages", () => {
    for (const language of ["rw", "en"] as const) for (const reason of ["other-disease", "low-confidence"] as const) expect(getUnsureInfo(reason, language).actions.length).toBeGreaterThan(0);
  });

  it("matches the shipped model's classes, threshold and version", () => {
    const shipped = JSON.parse(readFileSync(join(process.cwd(), "public/models/model_metadata.json"), "utf8"));
    expect(shipped.classes, "public/models has a model with different classes: copy in the retrained model").toEqual(MODEL_CLASS_LABELS);
    expect(MODEL_LABELS.length).toBe(MODEL_CLASS_LABELS.length);
    expect(MODEL_METADATA.unsureThreshold, "set UNSURE_THRESHOLD in lib/ml/model.ts to calibration.unsure_threshold").toBe(shipped.calibration?.unsure_threshold);
    expect(MODEL_METADATA.version, "set MODEL_VERSION in lib/ml/model.ts to the model's version").toBe(shipped.version);
  });

  it("returns safe Kinyarwanda fallback content", () => {
    expect(getDiseaseInfoRw("tomato_late_blight").name).toContain("Late blight");
    expect(getDiseaseInfoRw("unknown").warning).toBeTruthy();
  });

  it("finds verified local recommendations", () => {
    expect(getRecommendation("tomato_early_blight")?.actions.length).toBeGreaterThan(0);
    expect(getRecommendation("unknown")).toBeUndefined();
    expect(getRecommendation("tomato_other")).toBeUndefined();
  });

  it("persists and clears diagnosis history locally", async () => {
    await clearDiagnoses();
    await saveDiagnosis({ id: "test-1", createdAt: "2026-01-01T00:00:00.000Z", crop: "Tomato", disease: "Early blight", diseaseId: "tomato_early_blight", confidence: 0.9, modelVersion: "0.2.0" });
    expect((await getDiagnoses()).map((record) => record.id)).toEqual(["test-1"]);
    await clearDiagnoses();
    expect(await getDiagnoses()).toEqual([]);
  });
});
