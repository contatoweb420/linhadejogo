import type { Locale } from "@/lib/i18n";

// Existing editorial source files and writeFromTable templates are pt-PT.
// This describes the original content; a locale prefix never creates a translation.
// Add a translated variant only alongside its own published content and resolver.
export const ORIGINAL_ARTICLE_LOCALE: Locale = "pt-PT";
export function articleLocales(): readonly Locale[] {
  return [ORIGINAL_ARTICLE_LOCALE];
}
