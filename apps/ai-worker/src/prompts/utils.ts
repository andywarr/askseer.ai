import { logger } from "@/apps/shared/logger.ts";

/**
 * Resolves a locale code (e.g. "fr", "fr-FR", "es", "de") to the full English name of the language
 * (e.g. "French", "Spanish", "German", "English"). Defaults to "English".
 */
export function getLanguageName(locale?: string): string {
  if (!locale) return "English";
  const normalized = locale.toLowerCase().split("-")[0];
  const languageMap: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    nl: "Dutch",
    ru: "Russian",
    ar: "Arabic",
  };
  const name = languageMap[normalized];
  if (name) return name;
  logger.warn("Unrecognized locale, defaulting to English", { locale });
  return "English";
}

/**
 * Builds a locale instruction block for LLM prompts.
 * Returns empty string if the language is English.
 */
export function buildLocaleInstruction(languageName: string, fieldList: string): string {
  if (languageName === "English") return "";
  return `\n\n**CRITICAL: Language Requirement**\nYou MUST write all output text (${fieldList}) in ${languageName}. Do NOT write in English unless English is ${languageName}. However, keep any direct participant quotes or verbatim user responses in their original spoken language — do not translate those.`;
}
