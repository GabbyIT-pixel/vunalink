"use client";

// Client component so the text can follow the language chosen in Settings.
import { BottomNav } from "@/components/bottom-nav";
import { CropImagePicker } from "@/components/crop-image-picker";
import { useLanguage } from "@/components/language-provider";
import { ModelStatusNotice } from "@/components/model-status";

// Scan screen: intro text, the on-device notice, and the photo picker.
export default function ScanPage() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-28 pt-8 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{t.scan.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-950">{t.scan.title}</h1>
      <p className="mt-4 leading-7 text-stone-600">{t.scan.intro}</p>
      <ModelStatusNotice />
      <CropImagePicker />
      <BottomNav />
    </main>
  );
}
