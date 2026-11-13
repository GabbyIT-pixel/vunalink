"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { useLanguage } from "@/components/language-provider";
import { clearDiagnoses, getDiagnoses } from "@/lib/history/storage";
import type { DiagnosisRecord } from "@/lib/history/types";
import { DATE_LOCALES, type Language } from "@/lib/i18n/dictionaries";
import { DISEASE_INFO_RW, getDiseaseInfo, getUnsureInfo } from "@/lib/localization/disease-info";

const UNSURE_PREFIX = "unsure_";
const UNSURE_REASONS = ["other-disease", "low-confidence"] as const;

// History screen: every crop check saved on this device, newest first.
export default function HistoryPage() {
  const { language, t } = useLanguage();
  const [records, setRecords] = useState<DiagnosisRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => { void getDiagnoses().then(setRecords).catch(() => setError(true)).finally(() => setIsLoading(false)); }, []);

  // Ask first, because deleting the history cannot be undone.
  const clearHistory = async () => {
    if (!window.confirm(t.history.confirmClear)) return;
    try { await clearDiagnoses(); setRecords([]); setSelected(null); } catch { setError(true); }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-28 pt-8 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{t.history.eyebrow}</p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">{t.history.title}</h1>
          <p className="mt-3 leading-7 text-stone-600">{t.history.intro}</p>
        </div>
        {records.length > 0 && <button type="button" onClick={() => void clearHistory()} className="mt-1 shrink-0 text-sm font-semibold text-red-700">{t.history.clearAll}</button>}
      </div>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-stone-500">{t.history.loading}</p>
      ) : error ? (
        <p role="alert" className="mt-10 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{t.history.unavailable}</p>
      ) : records.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="font-semibold text-stone-900">{t.history.emptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">{t.history.emptyBody}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {records.map((record) => (
            <button type="button" key={record.id} onClick={() => setSelected(selected === record.id ? null : record.id)} className="w-full rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-stone-900">{getRecordTitle(record, language)}</p>
                  <p className="mt-1 text-xs text-stone-500">{formatDate(record.createdAt, language)}</p>
                </div>
                <p className="font-semibold text-emerald-800">{(record.confidence * 100).toFixed(1)}%</p>
              </div>
              {selected === record.id && (
                <div className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-600">
                  <p>{t.history.modelVersion}: <span className="font-medium text-stone-900">v{record.modelVersion}</span></p>
                  {record.thumbnail && <img src={URL.createObjectURL(record.thumbnail)} alt={t.history.savedPhotoAlt} className="mt-3 aspect-video w-full rounded-xl object-cover" />}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}

// Show a saved date the way people read dates in the chosen language.
function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(DATE_LOCALES[language], { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

// Work out the heading for a saved check in the chosen language.
// Records store the disease name in English at save time, so we look it up again from
// diseaseId instead. That also translates checks saved before this feature existed.
function getRecordTitle(record: DiagnosisRecord, language: Language): string {
  // "Unsure" results are saved as e.g. "unsure_low-confidence".
  if (record.diseaseId.startsWith(UNSURE_PREFIX)) {
    const reason = UNSURE_REASONS.find((candidate) => record.diseaseId === UNSURE_PREFIX + candidate);
    if (reason) return getUnsureInfo(reason, language).title;
  }

  // Known diseases have their own translated name (which already includes the crop).
  if (record.diseaseId in DISEASE_INFO_RW) return getDiseaseInfo(record.diseaseId, language).name;

  // Unknown id (e.g. from an older model): fall back to what was saved.
  return `${record.crop} · ${record.disease}`;
}
