import type { ImageValidationError } from "@/lib/image/validation";

// Every language VunaLink supports. Kinyarwanda comes first because it is the default.
export const SUPPORTED_LANGUAGES = ["rw", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "rw";

// English text. Its shape is the "contract" every other language must follow.
const en = {
  app: {
    tagline: "Healthy crops, stronger harvests",
  },
  nav: { home: "Home", history: "History", scan: "Scan", settings: "Settings", profile: "Profile", label: "Main navigation" },
  home: {
    eyebrow: "Your crop companion",
    title: "Protect your harvest.",
    description: "Take a photo of a crop to learn what may be affecting it and what to do next.",
    scan: "Scan Crop",
    scanHint: "Use your camera or choose a photo",
    history: "View History",
    historyHint: "See your previous crop checks",
  },
  scan: {
    eyebrow: "Scan",
    title: "Check a crop",
    intro: "Take a clear photo of a leaf or choose one from your phone.",
  },
  modelStatus: {
    title: "Analysis happens on this device",
    body: "Your photo stays on your phone. The model loads when you start an analysis and may take a little longer on some devices.",
  },
  history: {
    eyebrow: "History",
    title: "Your crop checks",
    intro: "Saved on this device and available offline.",
    clearAll: "Clear all",
    confirmClear: "Clear all saved crop checks from this device?",
    loading: "Loading saved checks…",
    unavailable: "Saved history is not available on this device.",
    emptyTitle: "No crop checks yet",
    emptyBody: "Your local diagnoses will appear here after you analyze a crop.",
    modelVersion: "Model version",
    savedPhotoAlt: "Saved crop",
  },
  profile: {
    eyebrow: "Profile",
    title: "Your profile",
    body: "Your farmer profile will appear here.",
  },
  settings: {
    eyebrow: "Settings",
    title: "App settings",
    intro: "Choose how VunaLink looks and which language it uses.",
    appearance: "Appearance",
    appearanceGroup: "Choose appearance",
    light: "Light", lightHint: "Bright and clear",
    dark: "Dark", darkHint: "Easier on the eyes",
    language: "Language",
    languageGroup: "Choose language",
  },
  offline: {
    online: "Online",
    offline: "Offline mode",
  },
  install: {
    label: "Install VunaLink",
    message: "Install VunaLink for quick offline access.",
    notNow: "Not now",
    install: "Install",
  },
  // Keys match the codes returned by validateImageFile, so the build fails if one is missing.
  imageErrors: {
    noImage: "No image selected. Choose a crop photo to continue.",
    unsupportedType: "Choose a JPG, PNG, or WebP image.",
    tooLarge: "That image is too large. Choose one smaller than 10 MB.",
  } satisfies Record<ImageValidationError, string>,
};

// Typing rw as Dictionary makes the build fail if a key is missing,
// so no screen can silently fall back to English.
export type Dictionary = typeof en;

// Kinyarwanda text. Have a native speaker review this before the pilot.
const rw: Dictionary = {
  app: {
    tagline: "Ibihingwa bizima, umusaruro mwinshi",
  },
  nav: { home: "Ahabanza", history: "Amateka", scan: "Suzuma", settings: "Igenamiterere", profile: "Umwirondoro", label: "Ibikubiyemo by'ingenzi" },
  home: {
    eyebrow: "Umufasha wawe mu buhinzi",
    title: "Rinda umusaruro wawe.",
    description: "Fata ifoto y'igihingwa umenye ikibazo gishobora kuba gifite n'icyo wakora.",
    scan: "Suzuma igihingwa",
    scanHint: "Koresha kamera cyangwa uhitemo ifoto",
    history: "Reba amateka",
    historyHint: "Reba amasuzuma wakoze mbere",
  },
  scan: {
    eyebrow: "Gusuzuma",
    title: "Suzuma igihingwa",
    intro: "Fata ifoto igaragara neza y'ibabi cyangwa uhitemo iri muri telefoni yawe.",
  },
  modelStatus: {
    title: "Isuzuma rikorerwa kuri iyi telefoni",
    body: "Ifoto yawe iguma muri telefoni yawe. Model itangira gukora igihe utangiye isuzuma, kandi ishobora gutinda gato kuri telefoni zimwe.",
  },
  history: {
    eyebrow: "Amateka",
    title: "Amasuzuma yawe",
    intro: "Abitswe kuri iyi telefoni kandi aboneka nta interineti.",
    clearAll: "Siba byose",
    confirmClear: "Usibe amasuzuma yose abitswe kuri iyi telefoni?",
    loading: "Turimo gufungura amasuzuma abitswe…",
    unavailable: "Amateka abitswe ntaboneka kuri iyi telefoni.",
    emptyTitle: "Nta suzuma rirakorwa",
    emptyBody: "Amasuzuma yawe azagaragara hano nyuma yo gusuzuma igihingwa.",
    modelVersion: "Verisiyo ya model",
    savedPhotoAlt: "Ifoto y'igihingwa yabitswe",
  },
  profile: {
    eyebrow: "Umwirondoro",
    title: "Umwirondoro wawe",
    body: "Umwirondoro wawe nk'umuhinzi uzagaragara hano.",
  },
  settings: {
    eyebrow: "Igenamiterere",
    title: "Igenamiterere rya porogaramu",
    intro: "Hitamo uko VunaLink igaragara n'ururimi ikoresha.",
    appearance: "Imigaragarire",
    appearanceGroup: "Hitamo imigaragarire",
    light: "Urumuri", lightHint: "Bigaragara neza",
    dark: "Umwijima", darkHint: "Ntibinaniza amaso",
    language: "Ururimi",
    languageGroup: "Hitamo ururimi",
  },
  offline: {
    online: "Kuri interineti",
    offline: "Nta interineti",
  },
  install: {
    label: "Shyira VunaLink muri telefoni",
    message: "Shyira VunaLink muri telefoni yawe kugira ngo uyikoreshe vuba, ndetse nta interineti.",
    notNow: "Ubu oya",
    install: "Shyiramo",
  },
  imageErrors: {
    noImage: "Nta foto wahisemo. Hitamo ifoto y'igihingwa kugira ngo ukomeze.",
    unsupportedType: "Hitamo ifoto ya JPG, PNG cyangwa WebP.",
    tooLarge: "Iyo foto ni nini cyane. Hitamo iri munsi ya MB 10.",
  },
};

export const DICTIONARIES: Readonly<Record<Language, Dictionary>> = { en, rw };

// Locale used for dates and numbers, e.g. "13 Nov 2026" vs "2026 ugu. 13".
export const DATE_LOCALES: Readonly<Record<Language, string>> = { en: "en-RW", rw: "rw-RW" };

// Check that a stored value is a language we support.
// Protects against old or hand-edited values in localStorage.
export function isSupportedLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}
