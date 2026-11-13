"use client";

// Client component so the text can follow the language chosen in Settings.
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Camera01Icon, File01Icon } from "@hugeicons/core-free-icons";
import { BottomNav } from "@/components/bottom-nav";
import { useLanguage } from "@/components/language-provider";
import { OfflineStatus } from "@/components/offline-status";

// Home screen: the two main actions, scanning a crop and viewing past checks.
export default function Home() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-28 pt-6 sm:px-8 sm:pt-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/vunalink-icon.png" alt="" width={44} height={44} className="rounded-full" priority />
          <div><p className="text-lg font-bold tracking-tight text-emerald-900">VunaLink</p><p className="text-xs text-stone-500">{t.app.tagline}</p></div>
        </div>
        <OfflineStatus />
      </header>

      <section className="flex flex-1 flex-col justify-center py-14 sm:py-20">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{t.home.eyebrow}</p>
        <h1 className="max-w-sm text-[2.75rem] font-bold leading-[1.05] tracking-tight text-stone-950 sm:text-6xl">{t.home.title}</h1>
        <p className="mt-5 max-w-md text-base leading-7 text-stone-600 sm:text-lg">{t.home.description}</p>

        <div className="mt-9 space-y-3">
          <Link href="/scan" className="flex min-h-20 w-full items-center gap-4 rounded-2xl bg-emerald-800 px-5 text-left text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:bg-emerald-950">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-emerald-100"><HugeiconsIcon icon={Camera01Icon} size={25} /></span>
            <span className="flex flex-col"><span className="text-lg font-semibold">{t.home.scan}</span><span className="text-sm text-emerald-100">{t.home.scanHint}</span></span>
            <HugeiconsIcon icon={ArrowRight01Icon} size={22} className="ml-auto text-emerald-200" aria-hidden="true" />
          </Link>
          <Link href="/history" className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 text-left text-stone-800 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:bg-emerald-100">
            <span className="text-emerald-800"><HugeiconsIcon icon={File01Icon} size={21} /></span>
            <span className="flex flex-col"><span className="font-semibold">{t.home.history}</span><span className="text-sm text-stone-500">{t.home.historyHint}</span></span>
            <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="ml-auto text-stone-400" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
