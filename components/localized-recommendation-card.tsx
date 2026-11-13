"use client";

import { useLanguage } from "@/components/language-provider";
import type { LocalizedDiseaseInfo } from "@/lib/localization/disease-info";

// The advice shown under a diagnosis. `info` must already be in the chosen language
// (getDiseaseInfo(id, language)); the headings come from the dictionary.
export function LocalizedRecommendationCard({ info }: { info: LocalizedDiseaseInfo }) {
  const { t } = useLanguage();

  return (
    <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm" aria-label={t.recommendation.label}>
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t.recommendation.eyebrow}</p>
      <p className="mt-2 text-sm leading-6 text-stone-700">{info.explanation}</p>
      <Group title={t.recommendation.treatment} items={info.treatment} />
      <Group title={t.recommendation.symptoms} items={info.symptoms} />
      <Group title={t.recommendation.actions} items={info.actions} />
      <Group title={t.recommendation.prevention} items={info.prevention} />
      <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        <p className="font-semibold">{t.recommendation.warning}</p>
        <p className="mt-1">{info.warning}</p>
      </div>
      <p className="mt-4 border-t border-stone-100 pt-3 text-sm leading-6 text-stone-600">{info.assistance}</p>
    </section>
  );
}

// One titled bullet list (e.g. "Prevention"). Hidden when there is nothing to show.
function Group({ title, items }: { title: string; items: readonly string[] }) {
  if (!items.length) return null;

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-emerald-900">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-700">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}
