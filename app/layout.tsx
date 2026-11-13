import type { Metadata } from "next";
import { ServiceWorkerRegistration } from "./service-worker-registration";
import { InstallPrompt } from "@/components/install-prompt";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "VunaLink",
  description: "Offline crop disease detection for Rwandan farmers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="rw"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-stone-50 text-stone-950 transition-colors">
        <ThemeProvider><LanguageProvider>
    {children}<ServiceWorkerRegistration /><InstallPrompt />
  </LanguageProvider></ThemeProvider>
      </body>
    </html>
  );
}
