"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";

// Small badge that shows whether the phone is online, updating live when the connection changes.
export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${isOnline ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`} role="status" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-600" : "bg-amber-600"}`} aria-hidden="true" />
      {isOnline ? t.offline.online : t.offline.offline}
    </div>
  );
}
