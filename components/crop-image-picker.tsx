"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Camera01Icon, Cancel01Icon, Image01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { runInference } from "@/lib/ml/inference";
import { MODEL_METADATA } from "@/lib/ml/model";
import type { InferenceResult } from "@/lib/ml/types";
import { getDiseaseInfo, getUnsureInfo } from "@/lib/localization/disease-info";
import { LocalizedRecommendationCard } from "@/components/localized-recommendation-card";
import { saveDiagnosis } from "@/lib/history/storage";
import { validateImageFile, MAX_IMAGE_FILE_SIZE, ACCEPTED_IMAGE_TYPES } from "@/lib/image/validation";

const MAX_IMAGE_EDGE = 1600;

type SelectedImage = { file: File; fileName: string; url: string };

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

export function CropImagePicker() {
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [language, setLanguage] = useState<"rw" | "en">("rw");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

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
      setError("This image cannot be opened. Choose a different crop photo.");
    } finally {
      setIsPreparing(false);
    }
  };

  const removeImage = () => {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null); setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyze = async () => {
    if (!image) return;
    setError(null); setIsAnalyzing(true);
    const inferenceResult = await runInference(image.file, MODEL_METADATA);
    setResult(inferenceResult);
    if (inferenceResult.status === "error") setError(inferenceResult.message);
    if (inferenceResult.status === "unsupported-class") setError(`The model returned an unsupported crop class (${inferenceResult.classId}).`);
    if (inferenceResult.status === "prediction" || inferenceResult.status === "unsure") {
      const { prediction } = inferenceResult;
      const unsure = inferenceResult.status === "unsure";
      try {
        await saveDiagnosis({
          id: crypto.randomUUID(), createdAt: new Date().toISOString(), crop: prediction.crop,
          disease: unsure ? (inferenceResult.reason === "other-disease" ? "Ask an agent (other tomato problem)" : "Ask an agent (not sure)") : prediction.disease,
          diseaseId: unsure ? `unsure_${inferenceResult.reason}` : prediction.diseaseId,
          confidence: prediction.confidence, modelVersion: prediction.modelVersion,
        });
      } catch { /* History is optional if device storage is unavailable. */ }
    }
    setIsAnalyzing(false);
  };

  const languageToggle = <div className="join" role="group" aria-label="Result language"><button type="button" onClick={() => setLanguage("rw")} aria-pressed={language === "rw"} className={`join-item min-h-10 px-3 text-xs font-semibold ${language === "rw" ? "bg-emerald-800 text-white" : "bg-white text-stone-600"}`}>Kinyarwanda</button><button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"} className={`join-item min-h-10 px-3 text-xs font-semibold ${language === "en" ? "bg-emerald-800 text-white" : "bg-white text-stone-600"}`}>English</button></div>;

  return <section className="mt-8" aria-label="Crop image selection">
    <input ref={inputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void selectFile(event.target.files?.[0])} />
    <input id="crop-gallery" className="sr-only" type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={(event) => void selectFile(event.target.files?.[0])} />
    {isPreparing ? <div className="flex min-h-64 items-center justify-center rounded-2xl border border-stone-200 bg-white text-sm text-stone-600">Preparing your image…</div> : image ? <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="relative aspect-4/3 bg-stone-100"><Image src={image.url} alt="Selected crop" fill unoptimized className="object-cover" onError={() => { removeImage(); setError("This image cannot be displayed. Choose a different crop photo."); }} /><button type="button" onClick={removeImage} aria-label="Remove selected image" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-stone-700 shadow-sm"><HugeiconsIcon icon={Cancel01Icon} size={22} /></button></div><div className="flex items-center justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-2"><HugeiconsIcon icon={Image01Icon} size={20} className="shrink-0 text-emerald-700" /><p className="truncate text-sm font-medium text-stone-700">{image.fileName}</p></div><button type="button" onClick={removeImage} className="shrink-0 text-sm font-semibold text-emerald-800">Reselect</button></div></div> : <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 text-white shadow-sm hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-700"><HugeiconsIcon icon={Camera01Icon} size={30} /><span className="font-semibold">Take a photo</span><span className="text-xs text-emerald-100">Use your camera</span></button><label htmlFor="crop-gallery" className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-stone-800 shadow-sm focus-within:outline-2 focus-within:outline-emerald-700"><HugeiconsIcon icon={Upload01Icon} size={28} className="text-emerald-800" /><span className="font-semibold">Choose an image</span><span className="text-xs text-stone-500">From your phone</span></label></div>}
    {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><HugeiconsIcon icon={Alert02Icon} size={18} className="mt-0.5 shrink-0" />{error}</p>}
    <p className="mt-4 text-center text-xs text-stone-500">JPG, PNG, or WebP · Maximum {MAX_IMAGE_FILE_SIZE / (1024 * 1024)} MB</p>
    <button type="button" onClick={() => void analyze()} disabled={!image || isPreparing || isAnalyzing} className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-800 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500">{isAnalyzing ? "Analyzing on this device…" : "Analyze Crop"}</button>
    {result?.status === "prediction" && <><div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{language === "rw" ? "Icyo AI yasanze" : "AI result"}</p>{languageToggle}</div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-emerald-700">{language === "rw" ? "Igihingwa" : "Crop"}</p><p className="font-semibold text-stone-900">{language === "rw" ? "Inyanya" : result.prediction.crop}</p></div><div><p className="text-emerald-700">{language === "rw" ? "Indwara" : "Disease"}</p><p className="font-semibold text-stone-900">{getDiseaseInfo(result.prediction.diseaseId, language).name}</p></div><div><p className="text-emerald-700">{language === "rw" ? "Icyizere cya model" : "Confidence"}</p><p className="font-semibold text-stone-900">{(result.prediction.confidence * 100).toFixed(1)}%</p></div><div><p className="text-emerald-700">Model</p><p className="font-semibold text-stone-900">v{result.prediction.modelVersion}</p></div></div></div><p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-600">{language === "rw" ? "Iyi model yageragejwe ku mafoto yo muri laboratwari gusa, ntiragenzurwa ku mafoto yo mu murima. Saba umukozi w'ubujyanama mu buhinzi kwemeza iri suzuma." : "This model has only been tested on lab photos, not yet on farm photos. Ask an agricultural extension worker to confirm this result."}</p><LocalizedRecommendationCard info={getDiseaseInfo(result.prediction.diseaseId, language)} language={language} /></>}
    {result?.status === "unsure" && (() => { const info = getUnsureInfo(result.reason, language); return <section role="status" aria-label={info.title} className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-start justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800"><HugeiconsIcon icon={Alert02Icon} size={16} />{language === "rw" ? "Nta suzuma" : "No diagnosis"}</p>{languageToggle}</div><h2 className="mt-3 text-lg font-bold text-stone-900">{info.title}</h2><p className="mt-2 text-sm leading-6 text-stone-700">{info.explanation}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-700">{info.actions.map((action) => <li key={action}>{action}</li>)}</ul><p className="mt-3 border-t border-amber-200 pt-3 text-xs text-stone-500">{language === "rw" ? "Icyizere cya model" : "Model confidence"}: {(result.prediction.confidence * 100).toFixed(1)}% · v{result.prediction.modelVersion}</p></section>; })()}
  </section>;
}
