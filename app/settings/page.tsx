"use client";

import { BottomNav } from "@/components/bottom-nav";
import { useLanguage } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";

const OPTION_BASE_CLASS = "min-h-14 rounded-xl border px-4 text-left font-medium focus-visible:outline-2 focus-visible:outline-emerald-700";
const OPTION_IDLE_CLASS = "border-stone-200 text-stone-600 dark:border-stone-700 dark:text-stone-300";

// Settings screen: appearance (light/dark) and app language.
export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-stone-50 px-5 pb-28 pt-8 text-stone-950 dark:bg-stone-950 dark:text-stone-50 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{t.settings.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t.settings.title}</h1>
      <p className="mt-4 leading-7 text-stone-600 dark:text-stone-300">{t.settings.intro}</p>

      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900" aria-labelledby="appearance-title">
        <h2 id="appearance-title" className="font-semibold">{t.settings.appearance}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label={t.settings.appearanceGroup}>
          <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")} className={`${OPTION_BASE_CLASS} ${theme === "light" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : OPTION_IDLE_CLASS}`}>
            {t.settings.light}<span className="mt-1 block text-xs font-normal opacity-75">{t.settings.lightHint}</span>
          </button>
          <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} className={`${OPTION_BASE_CLASS} ${theme === "dark" ? "border-emerald-500 bg-emerald-950 text-emerald-100" : OPTION_IDLE_CLASS}`}>
            {t.settings.dark}<span className="mt-1 block text-xs font-normal opacity-75">{t.settings.darkHint}</span>
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900" aria-labelledby="language-title">
        <h2 id="language-title" className="font-semibold">{t.settings.language}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label={t.settings.languageGroup}>
          {/* Each language's name is written in that language (and tagged with lang)
              so people can always find their own, whatever the app is set to. */}
          <button type="button" lang="rw" aria-pressed={language === "rw"} onClick={() => setLanguage("rw")} className={`${OPTION_BASE_CLASS} ${language === "rw" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : OPTION_IDLE_CLASS}`}>
            Kinyarwanda
          </button>
          <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")} className={`${OPTION_BASE_CLASS} ${language === "en" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : OPTION_IDLE_CLASS}`}>
            English
          </button>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
