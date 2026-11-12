export type LocalizedDiseaseInfo = {
  diseaseId: string;
  name: string;
  explanation: string;
  symptoms: readonly string[];
  actions: readonly string[];
  treatment: readonly string[];
  prevention: readonly string[];
  warning: string;
  assistance: string;
};

export type SupportedLanguage = "en" | "rw";

const blight = (diseaseId: string, name: string, crop: string): LocalizedDiseaseInfo => ({
  diseaseId,
  name,
  explanation: `Ishusho yerekana ko ${crop} ishobora kuba ifite iyi ndwara. Ibi ni ubufasha bw'ikoranabuhanga, si isuzuma ridashidikanywaho.`,
  symptoms: ["Amababi agira utubara twijimye cyangwa duhinduye ibara.", "Amababi ashobora kuba umuhondo, kuma cyangwa kugwa.", "Ibimenyetso bishobora kwiyongera mu gihe cy'imvura cyangwa ubuhehere bwinshi."],
  actions: ["Reba n'ibindi bihingwa, cyane cyane amababi yo hasi.", "Kuraho ibice byangiritse cyane, ubishyire kure y'ibihingwa bizima.", "Saba umukozi w'ubujyanama mu buhinzi kugenzura indwara."],
  treatment: ["Kuraho amababi yanduye cyane igihe amababi yumye, uyashyire kure y' umurima.", "Vomerera ku butaka aho gutosa amababi, kandi utere amazi mu gitondo kugira ngo amababi yumuke vuba.", "Ku muti wica indwara, banza ubaze umukozi w'ubujyanama mu buhinzi kandi ukurikize amabwiriza ari ku gipfunyika cy'umuti wemewe."],
  prevention: ["Irinde gutosa amababi igihe uvomera, kandi utere amazi ku butaka.", "Ha ibihingwa umwanya uhagije kugira ngo umwuka unyuremo.", "Kuraho ibisigazwa by'ibihingwa nyuma y'isarura."],
  warning: "Ibimenyetso bisa bishobora guterwa n'indwara zitandukanye. Ntukoreshe umuti wica udukoko utabanje kugisha inama kandi utabanje gusoma amabwiriza yawo.",
  assistance: "Niba indwara ikwirakwira vuba cyangwa ifata ibihingwa byinshi, hamagara umukozi w'ubujyanama mu buhinzi.",
});

const healthy = (diseaseId: string, crop: string): LocalizedDiseaseInfo => ({
  diseaseId,
  name: `${crop} isa n'ifite ubuzima bwiza`,
  explanation: "Iyi foto ntiyagaragaje imwe mu ndwara ziri ku rutonde rw'iyi porogaramu.",
  symptoms: [],
  actions: ["Komeza kugenzura ibihingwa byawe buri gihe.", "Niba hagaragaye ibimenyetso bishya cyangwa bikiyongera, saba ubufasha."],
  treatment: ["Nta muti wihariye utangwa kuri iri suzuma. Komeza kugenzura igihingwa kandi ushake ubufasha niba ibimenyetso byiyongera."],
  prevention: ["Irinde gutosa amababi igihe uvomera.", "Ha ibihingwa umwanya uhagije kugira ngo umwuka unyuremo.", "Kuraho ibisigazwa by'ibihingwa nyuma y'isarura."],
  warning: "Kuvuga ko igihingwa gisa n'ikizima ntibivuze ko nta ndwara gifite. Ntukoreshe umuti wica udukoko utabanje kugisha inama.",
  assistance: "Saba umukozi w'ubujyanama mu buhinzi kugenzura ibimenyetso bishya cyangwa bikomeza kwiyongera.",
});

export const DISEASE_INFO_RW: Readonly<Record<string, LocalizedDiseaseInfo>> = {
  tomato_early_blight: blight("tomato_early_blight", "Ibibara by'amababi ku nyanya (Early blight)", "inyanya"),
  tomato_late_blight: blight("tomato_late_blight", "Indwara ikwirakwira vuba ku nyanya (Late blight)", "inyanya"),
  tomato_healthy: healthy("tomato_healthy", "inyanya"),
};

const englishNames: Readonly<Record<string, string>> = {
  tomato_early_blight: "Tomato early blight", tomato_late_blight: "Tomato late blight", tomato_healthy: "Tomato appears healthy",
};

export function getDiseaseInfo(id: string, language: SupportedLanguage = "rw"): LocalizedDiseaseInfo {
  if (language === "rw") return getDiseaseInfoRw(id);
  const info = getDiseaseInfoRw(id);
  if (id.endsWith("_healthy")) return { ...info, name: englishNames[id] ?? "Crop appears healthy", explanation: "No supported disease was detected by the model.", symptoms: [], actions: ["Continue checking the crop regularly.", "Ask an agricultural extension worker if new or worsening symptoms appear."], treatment: ["No specific treatment is indicated by this result. Continue monitoring the crop and seek advice if symptoms appear."], prevention: ["Keep foliage dry where practical.", "Give plants enough space for air movement.", "Remove crop remains after harvest."], warning: "A healthy prediction does not guarantee that a plant is disease-free.", assistance: "Ask an agricultural extension worker if symptoms appear or worsen." };
  return { ...info, name: englishNames[id] ?? "Crop assessment", explanation: "This is an AI-assisted prediction, not a confirmed diagnosis.", symptoms: info.symptoms.length ? ["Dark or discolored leaf spots", "Leaves may yellow, dry, or fall", "Symptoms may worsen in wet weather"] : [], actions: ["Inspect nearby plants, especially older leaves.", "Remove severely affected plant parts and keep them away from healthy crops.", "Ask an agricultural extension worker to confirm the diagnosis."], treatment: ["Remove severely affected leaves when they are dry and dispose of them away from the field.", "Water the soil rather than wetting leaves, preferably early so foliage can dry.", "Ask an agricultural extension worker about any approved treatment and follow the product label exactly."], prevention: ["Keep leaves dry where practical and water the soil.", "Give plants enough space for air movement.", "Remove crop remains after harvest."], warning: "Similar symptoms can have different causes. Do not use a chemical product unless it is approved locally and its label is followed.", assistance: "Seek an agricultural extension worker if symptoms spread quickly or affect many plants." };
}

export function getDiseaseInfoRw(diseaseId: string): LocalizedDiseaseInfo {
  return DISEASE_INFO_RW[diseaseId] ?? {
    diseaseId,
    name: "Ibisubizo by'isuzuma",
    explanation: "Iyi ni porogaramu ifasha gutanga igitekerezo ku ndwara z'ibihingwa.",
    symptoms: ["Reba impinduka ku mababi, ku giti cyangwa ku mbuto."],
    actions: ["Saba umukozi w'ubujyanama mu buhinzi kugenzura igihingwa."],
    treatment: ["Banza ubaze umukozi w'ubujyanama mu buhinzi mbere yo gukoresha umuti uwo ari wo wose."],
    prevention: ["Komeza kugenzura ibihingwa byawe buri gihe."],
    warning: "Ibi ni igitekerezo cy'ubwenge buhangano, si isuzuma ridashidikanywaho.",
    assistance: "Saba ubufasha bw'umukozi w'ubujyanama mu buhinzi niba ufite impungenge.",
  };
}

// Shown when the model routes a result to an extension agent instead of giving a diagnosis.
// The Kinyarwanda text needs review by an agronomist / native speaker before the pilot.
export type UnsureInfo = { title: string; explanation: string; actions: readonly string[] };

const UNSURE_INFO: Readonly<Record<SupportedLanguage, Record<"other-disease" | "low-confidence", UnsureInfo>>> = {
  rw: {
    "other-disease": {
      title: "Baza umukozi w'ubujyanama mu buhinzi",
      explanation: "Iyi foto ntihuye n'indwara z'inyanya iyi porogaramu izi. Bishobora kuba ari indi ndwara, cyangwa atari igihingwa cy'inyanya. Ntukoreshe umuti utabanje kugisha inama.",
      actions: ["Niba iyi foto atari iy'ibabi ry'inyanya, fata ifoto y'ibabi rimwe ry'inyanya, uri hafi.", "Saba umukozi w'ubujyanama mu buhinzi kugenzura igihingwa.", "Mwereke iyi foto n'ibihingwa byafashwe.", "Kuraho ibice byangiritse cyane, ubishyire kure y'ibihingwa bizima."],
    },
    "low-confidence": {
      title: "Porogaramu ntiyizeye neza: baza umukozi w'ubujyanama",
      explanation: "Porogaramu ntiyashoboye kumenya neza icyo iyi foto yerekana, bityo nta suzuma itanga.",
      actions: ["Fata indi foto y'ibabi rimwe, hafi, ahari urumuri ruhagije.", "Niba bikomeje, saba umukozi w'ubujyanama mu buhinzi kugenzura igihingwa."],
    },
  },
  en: {
    "other-disease": {
      title: "Ask an extension agent",
      explanation: "This photo doesn't match the tomato problems this app knows. It may be another disease, or not a tomato plant. Do not use a chemical product before getting advice.",
      actions: ["If this isn't a tomato leaf, take a close-up photo of a single tomato leaf.", "Ask an agricultural extension worker to check the plant.", "Show them this photo and the affected plants.", "Remove severely affected plant parts and keep them away from healthy crops."],
    },
    "low-confidence": {
      title: "Not sure: ask an extension agent",
      explanation: "The app could not tell clearly what this photo shows, so it is not giving a diagnosis.",
      actions: ["Take another photo of a single leaf, close up, in good light.", "If it still says unsure, ask an agricultural extension worker to check the plant."],
    },
  },
};

export function getUnsureInfo(reason: "other-disease" | "low-confidence", language: SupportedLanguage = "rw"): UnsureInfo {
  return UNSURE_INFO[language][reason];
}
