"use client";

import { useLanguage } from "@/components/language-provider";

// Reassures the user that their photo never leaves the phone.
export function ModelStatusNotice() {
  const { t } = useLanguage();

  return (
    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="note">
      <p className="font-semibold">{t.modelStatus.title}</p>
      <p className="mt-1 leading-6">{t.modelStatus.body}</p>
    </div>
  );
}
