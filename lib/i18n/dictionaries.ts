import type { ImageValidationError } from "@/lib/image/validation";
import type { InferenceErrorCode } from "@/lib/ml/types";

// Every error the scan screen can show: bad file, image that won't open, or model problems.
export type ScanErrorCode = ImageValidationError | InferenceErrorCode | "imageOpenFailed" | "imageDisplayFailed" | "unsupportedClass";

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
    sectionLabel: "Crop image selection",
    preparing: "Preparing your image…",
    selectedPhotoAlt: "Selected crop",
    removeImage: "Remove selected image",
    reselect: "Reselect",
    takePhoto: "Take a photo",
    takePhotoHint: "Use your camera",
    chooseImage: "Choose an image",
    chooseImageHint: "From your phone",
    fileRules: "JPG, PNG, or WebP · Maximum 10 MB",
    analyze: "Analyze Crop",
    analyzing: "Analyzing on this device…",
  },
  result: {
    aiResult: "AI result",
    crop: "Crop",
    disease: "Disease",
    confidence: "Confidence",
    model: "Model",
    fieldWarning: "This model has been tested on lab photos and a small set of field photos from the web, not yet on farms in Rwanda. Ask an agricultural extension worker to confirm this result.",
    noDiagnosis: "No diagnosis",
    modelConfidence: "Model confidence",
  },
  // Keys match the `crop` values in lib/ml/labels.ts.
  crops: {
    Tomato: "Tomato",
  },
  recommendation: {
    label: "Agricultural guidance",
    eyebrow: "What to do",
    treatment: "Treatment guidance",
    symptoms: "What to look for",
    actions: "Actions",
    prevention: "Prevention",
    warning: "Warning",
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
  // One message per ScanErrorCode, so the build fails if a new error has no text.
  scanErrors: {
    noImage: "No image selected. Choose a crop photo to continue.",
    unsupportedType: "Choose a JPG, PNG, or WebP image.",
    tooLarge: "That image is too large. Choose one smaller than 10 MB.",
    imageOpenFailed: "This image cannot be opened. Choose a different crop photo.",
    imageDisplayFailed: "This image cannot be displayed. Choose a different crop photo.",
    unsupportedClass: "The model returned a crop type this app does not know. Update the app.",
    modelLoadFailed: "The crop model could not be loaded on this phone. Close and reopen the app, or update it.",
    modelMissingInput: "The crop model is missing its settings. Update the app.",
    analysisFailed: "This photo could not be analyzed on this phone. Try another photo.",
    invalidOutput: "The model returned an invalid result. Try another photo.",
    modelMismatch: "The crop model does not match this version of the app. Update the app.",
  } satisfies Record<ScanErrorCode, string>,
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
    sectionLabel: "Guhitamo ifoto y'igihingwa",
    preparing: "Turimo gutegura ifoto yawe…",
    selectedPhotoAlt: "Ifoto y'igihingwa wahisemo",
    removeImage: "Kuraho ifoto wahisemo",
    reselect: "Hitamo indi",
    takePhoto: "Fata ifoto",
    takePhotoHint: "Koresha kamera",
    chooseImage: "Hitamo ifoto",
    chooseImageHint: "Iri muri telefoni yawe",
    fileRules: "JPG, PNG cyangwa WebP · Ntirenze MB 10",
    analyze: "Suzuma igihingwa",
    analyzing: "Turimo gusuzuma kuri iyi telefoni…",
  },
  result: {
    aiResult: "Icyo AI yasanze",
    crop: "Igihingwa",
    disease: "Indwara",
    confidence: "Icyizere cya model",
    model: "Model",
    fieldWarning: "Iyi model yageragejwe ku mafoto yo muri laboratwari n'amafoto make yo mu mirima yo kuri internet, ntiragenzurwa mu mirima yo mu Rwanda. Saba umukozi w'ubujyanama mu buhinzi kwemeza iri suzuma.",
    noDiagnosis: "Nta suzuma",
    modelConfidence: "Icyizere cya model",
  },
  crops: {
    Tomato: "Inyanya",
  },
  recommendation: {
    label: "Inama z'ubuhinzi",
    eyebrow: "Icyo wakora",
    treatment: "Uko wabivura",
    symptoms: "Ibyo wareba",
    actions: "Ibyo wakora",
    prevention: "Uko wayirinda",
    warning: "Icyitonderwa",
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
  scanErrors: {
    noImage: "Nta foto wahisemo. Hitamo ifoto y'igihingwa kugira ngo ukomeze.",
    unsupportedType: "Hitamo ifoto ya JPG, PNG cyangwa WebP.",
    tooLarge: "Iyo foto ni nini cyane. Hitamo iri munsi ya MB 10.",
    imageOpenFailed: "Iyi foto ntishobora gufunguka. Hitamo indi foto y'igihingwa.",
    imageDisplayFailed: "Iyi foto ntishobora kugaragara. Hitamo indi foto y'igihingwa.",
    unsupportedClass: "Model yatanze igisubizo iyi porogaramu itazi. Vugurura porogaramu.",
    modelLoadFailed: "Model isuzuma ibihingwa ntiyashoboye gufunguka kuri iyi telefoni. Funga porogaramu wongere uyifungure, cyangwa uyivugurure.",
    modelMissingInput: "Model isuzuma ibihingwa ibura amagenamiterere yayo. Vugurura porogaramu.",
    analysisFailed: "Iyi foto ntiyashoboye gusuzumwa kuri iyi telefoni. Gerageza indi foto.",
    invalidOutput: "Model yatanze igisubizo kidasobanutse. Gerageza indi foto.",
    modelMismatch: "Model iri kuri iyi telefoni ntihuye n'iyi verisiyo ya porogaramu. Vugurura porogaramu.",
  },
};

// Show a crop name (e.g. "Tomato" from the model labels) in the chosen language.
// Falls back to the original name if a new crop has not been translated yet.
export function translateCrop(crop: string, dictionary: Dictionary): string {
  return (dictionary.crops as Readonly<Record<string, string>>)[crop] ?? crop;
}

export const DICTIONARIES: Readonly<Record<Language, Dictionary>> = { en, rw };

// Locale used for dates and numbers, e.g. "13 Nov 2026" vs "2026 ugu. 13".
export const DATE_LOCALES: Readonly<Record<Language, string>> = { en: "en-RW", rw: "rw-RW" };

// Check that a stored value is a language we support.
// Protects against old or hand-edited values in localStorage.
export function isSupportedLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}
