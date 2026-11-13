export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;

// Error codes instead of sentences, so the screen can show them in the user's language.
// The matching text lives in lib/i18n/dictionaries.ts under `imageErrors`.
export type ImageValidationError = "noImage" | "unsupportedType" | "tooLarge";

// Check a picked file before we try to open it.
// Returns an error code, or null when the file is fine.
export function validateImageFile(file?: Pick<File, "type" | "size">): ImageValidationError | null {
  if (!file) return "noImage";
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return "unsupportedType";
  if (file.size > MAX_IMAGE_FILE_SIZE) return "tooLarge";
  return null;
}
