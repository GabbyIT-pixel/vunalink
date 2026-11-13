"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon, Home01Icon, ScanIcon, Settings01Icon, User03Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Every key in `nav` except the menu's own aria-label is a menu item label.
type NavLabelKey = Exclude<keyof Dictionary["nav"], "label">;

// Labels are dictionary keys, not text, so the menu follows the chosen language.
const NAV_ITEMS = [
  { href: "/", labelKey: "home", icon: Home01Icon },
  { href: "/history", labelKey: "history", icon: File01Icon },
  { href: "/scan", labelKey: "scan", icon: ScanIcon },
  { href: "/settings", labelKey: "settings", icon: Settings01Icon },
  { href: "/profile", labelKey: "profile", icon: User03Icon },
] as const satisfies readonly { href: string; labelKey: NavLabelKey; icon: unknown }[];

// The fixed menu at the bottom of every screen. The Scan button is raised in the middle.
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur" aria-label={t.nav.label}>
      <div className="mx-auto grid max-w-xl grid-cols-5 items-end">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isScan = item.href === "/scan";
          return (
            <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${isScan ? "-mt-6" : ""} ${isActive && !isScan ? "text-emerald-800" : "text-stone-500 hover:text-emerald-700"}`}>
              <span className={`flex items-center justify-center ${isScan ? "h-14 w-14 rounded-full bg-emerald-800 text-white shadow-lg ring-4 ring-white" : "h-7"}`} aria-hidden="true">
                <HugeiconsIcon icon={item.icon} size={isScan ? 28 : 21} strokeWidth={isActive ? 2 : 1.6} />
              </span>
              <span className={isScan ? "font-semibold text-emerald-800" : ""}>{t.nav[item.labelKey]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
