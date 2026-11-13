"use client";

// Client component so the text can follow the language chosen in Settings.
import { HugeiconsIcon } from "@hugeicons/react";
import { User03Icon } from "@hugeicons/core-free-icons";
import { BottomNav } from "@/components/bottom-nav";
import { useLanguage } from "@/components/language-provider";

// Profile screen. A placeholder until farmer profiles are built.
export default function ProfilePage() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-28 pt-8 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{t.profile.eyebrow}</p>
      <div className="mt-5 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><HugeiconsIcon icon={User03Icon} size={28} /></span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-950">{t.profile.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{t.profile.body}</p>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
