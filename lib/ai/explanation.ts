import type { Language } from "@/lib/i18n/dictionaries";
import type { Recommendation } from "@/lib/recommendations/types";
import type { LocalAiProvider } from "./types";

export type ExplanationResult = { text: string; source: "knowledge-base" | "local-ai" };

// Explain the guidance in the user's language using the local AI if one is available.
// Falls back to the verified knowledge-base text if there is no AI or it fails.
export async function explainGuidance(guidance: Recommendation, language: Language, provider?: LocalAiProvider): Promise<ExplanationResult> {
  if (provider) {
    try {
      const text = await provider.generateExplanation({ diseaseId: guidance.diseaseId, prediction: guidance.explanation, language });
      return { text, source: "local-ai" };
    } catch { /* Verified guidance remains the safe fallback. */ }
  }
  return { text: guidance.explanation, source: "knowledge-base" };
}
