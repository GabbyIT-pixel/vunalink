"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Camera01Icon, Cancel01Icon, Image01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { runInference } from "@/lib/ml/inference";
import { MODEL_METADATA } from "@/lib/ml/model";
import type { InferenceResult } from "@/lib/ml/types";
import { getDiseaseInfo, getUnsureInfo } from "@/lib/localization/disease-info";
import { translateCrop, type ScanErrorCode } from "@/lib/i18n/dictionaries";
import { LocalizedRecommendationCard } from "@/components/localized-recommendation-card";
import { useLanguage } from "@/components/language-provider";
import { saveDiagnosis } from "@/lib/history/storage";
import { validateImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/image/validation";

const MAX_IMAGE_EDGE = 1600;

type SelectedImage = { file: File; fileName: string; url: string };

// Shrink large photos to at most MAX_IMAGE_EDGE pixels so analysis is fast on low-end phones.
// Returns the (possibly resized) file plus a preview URL. Throws if the image can't be decoded.
async function prepareImage(file: File): Promise<SelectedImage> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    let preparedFile = file;

    if (scale < 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("image-processing");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
      if (!blob) throw new Error("image-processing");
      preparedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
      canvas.width = 1;
      canvas.height = 1;
    }

    bitmap.close();
    return { file: preparedFile, fileName: preparedFile.name, url: URL.createObjectURL(preparedFile) };
  } catch {
    throw new Error("invalid-image");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

// Photo picker + on-device analysis + result. All text follows the language chosen in Settings.
export function CropImagePicker() {
  const [image, setImage] = useState<SelectedImage | null>(null);
  // Stored as a code, not text, so the message is always shown in the current language.
  const [error, setError] = useState<ScanErrorCode | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const { language, t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  // Check the picked file, then resize it for preview and analysis.
  const selectFile = async (file?: File) => {
    setError(null); setResult(null);
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return; }
    if (!file) return;

    setIsPreparing(true);
    try {
      const prepared = await prepareImage(file);
      setImage((current) => { if (current) URL.revokeObjectURL(current.url); return prepared; });
    } catch {
      setError("imageOpenFailed");
    } finally {
      setIsPreparing(false);
    }
  };

  // Clear the chosen photo and any result, so the user can pick again.
  const removeImage = () => {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null); setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Run the model on this phone, show the result, and save it to History.
  const analyze = async () => {
    if (!image) return;
    setError(null); setIsAnalyzing(true);
    const inferenceResult = await runInference(image.file, MODEL_METADATA);
    setResult(inferenceResult);
    if (inferenceResult.status === "error") setError(inferenceResult.code);
    if (inferenceResult.status === "unsupported-class") setError("unsupportedClass");
    if (inferenceResult.status === "prediction" || inferenceResult.status === "unsure") {
      const { prediction } = inferenceResult;
      const unsure = inferenceResult.status === "unsure";
      try {
        // History screens translate from diseaseId, so the English `disease` text is only a fallback.
        await saveDiagnosis({
          id: crypto.randomUUID(), createdAt: new Date().toISOString(), crop: prediction.crop,
          disease: unsure ? (inferenceResult.reason === "other-disease" ? "Ask an agent (not a known tomato problem)" : "Ask an agent (not sure)") : prediction.disease,
          diseaseId: unsure ? `unsure_${inferenceResult.reason}` : prediction.diseaseId,
          confidence: prediction.confidence, modelVersion: prediction.modelVersion,
        });
      } catch { /* History is optional if device storage is unavailable. */ }
    }
    setIsAnalyzing(false);
  };

  return (
    <section className="mt-8" aria-label={t.scan.sectionLabel}>
      <input ref={inputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void selectFile(event.target.files?.[0])} />
      <input id="crop-gallery" className="sr-only" type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={(event) => void selectFile(event.target.files?.[0])} />

      {isPreparing ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-stone-200 bg-white text-sm text-stone-600">{t.scan.preparing}</div>
      ) : image ? (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="relative aspect-4/3 bg-stone-100">
            <Image src={image.url} alt={t.scan.selectedPhotoAlt} fill unoptimized className="object-cover" onError={() => { removeImage(); setError("imageDisplayFailed"); }} />
            <button type="button" onClick={removeImage} aria-label={t.scan.removeImage} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-stone-700 shadow-sm"><HugeiconsIcon icon={Cancel01Icon} size={22} /></button>
          </div>
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-2"><HugeiconsIcon icon={Image01Icon} size={20} className="shrink-0 text-emerald-700" /><p className="truncate text-sm font-medium text-stone-700">{image.fileName}</p></div>
            <button type="button" onClick={removeImage} className="shrink-0 text-sm font-semibold text-emerald-800">{t.scan.reselect}</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 text-white shadow-sm hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-700">
            <HugeiconsIcon icon={Camera01Icon} size={30} /><span className="font-semibold">{t.scan.takePhoto}</span><span className="text-xs text-emerald-100">{t.scan.takePhotoHint}</span>
          </button>
          <label htmlFor="crop-gallery" className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-stone-800 shadow-sm focus-within:outline-2 focus-within:outline-emerald-700">
            <HugeiconsIcon icon={Upload01Icon} size={28} className="text-emerald-800" /><span className="font-semibold">{t.scan.chooseImage}</span><span className="text-xs text-stone-500">{t.scan.chooseImageHint}</span>
          </label>
        </div>
      )}

      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><HugeiconsIcon icon={Alert02Icon} size={18} className="mt-0.5 shrink-0" />{t.scanErrors[error]}</p>}
      <p className="mt-4 text-center text-xs text-stone-500">{t.scan.fileRules}</p>
      <button type="button" onClick={() => void analyze()} disabled={!image || isPreparing || isAnalyzing} className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-800 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500">{isAnalyzing ? t.scan.analyzing : t.scan.analyze}</button>

      {result?.status === "prediction" && (
        <>
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t.result.aiResult}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-emerald-700">{t.result.crop}</p><p className="font-semibold text-stone-900">{translateCrop(result.prediction.crop, t)}</p></div>
              <div><p className="text-emerald-700">{t.result.disease}</p><p className="font-semibold text-stone-900">{getDiseaseInfo(result.prediction.diseaseId, language).name}</p></div>
              <div><p className="text-emerald-700">{t.result.confidence}</p><p className="font-semibold text-stone-900">{(result.prediction.confidence * 100).toFixed(1)}%</p></div>
              <div><p className="text-emerald-700">{t.result.model}</p><p className="font-semibold text-stone-900">v{result.prediction.modelVersion}</p></div>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-600">{t.result.fieldWarning}</p>
          <LocalizedRecommendationCard info={getDiseaseInfo(result.prediction.diseaseId, language)} />
        </>
      )}

      {result?.status === "unsure" && <UnsureResult result={result} />}
    </section>
  );
}

// Shown instead of a diagnosis when the model is unsure or sees a problem it wasn't trained on.
function UnsureResult({ result }: { result: Extract<InferenceResult, { status: "unsure" }> }) {
  const { language, t } = useLanguage();
  const info = getUnsureInfo(result.reason, language);

  return (
    <section role="status" aria-label={info.title} className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800"><HugeiconsIcon icon={Alert02Icon} size={16} />{t.result.noDiagnosis}</p>
      <h2 className="mt-3 text-lg font-bold text-stone-900">{info.title}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">{info.explanation}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-700">{info.actions.map((action) => <li key={action}>{action}</li>)}</ul>
      <p className="mt-3 border-t border-amber-200 pt-3 text-xs text-stone-500">{t.result.modelConfidence}: {(result.prediction.confidence * 100).toFixed(1)}% · v{result.prediction.modelVersion}</p>
    </section>
  );
}
