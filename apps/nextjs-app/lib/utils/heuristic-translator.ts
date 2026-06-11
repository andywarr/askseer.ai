import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { logger } from "@/apps/shared/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "mock-key-for-testing",
  dangerouslyAllowBrowser: true,
});

const MODEL = process.env.TRANSLATION_MODEL ?? "gpt-4o-mini";

// Process memory cache for server-side heuristic translations
// Key: `${familyId}-${locale}`
const serverHeuristicCache = new Map<string, any>();

/**
 * Clears the server-side heuristic translation cache.
 * Primarily used in unit tests.
 */
export function clearHeuristicCache(): void {
  serverHeuristicCache.clear();
}


/**
 * Maps a locale string prefix to the full English name of the target language.
 * Defaults to "English".
 */
export function getLanguageName(locale?: string): string {
  if (!locale) return "English";
  const normalized = locale.toLowerCase().split("-")[0];
  switch (normalized) {
    case "es":
      return "Spanish";
    case "de":
      return "German";
    case "fr":
      return "French";
    default:
      return "English";
  }
}

const TranslatedHeuristicSchema = z.object({
  id: z.string(),
  heuristic: z.string(),
  label: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  examples: z.array(z.object({
    id: z.string(),
    title: z.string().optional().nullable(),
    example: z.string()
  })).optional().nullable()
});

const TranslatedFamilySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  heuristics: z.array(TranslatedHeuristicSchema).optional().nullable()
});

const BulkFamiliesSchema = z.object({
  families: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional().nullable()
  }))
});

/**
 * Translates a single heuristic family's name, description, and list of heuristics
 * (including examples) into the target locale.
 */
export async function translateHeuristicFamily(family: any, locale: string): Promise<any> {
  if (!family) return family;
  if (!locale || locale.toLowerCase().startsWith("en")) {
    return family;
  }
  const language = getLanguageName(locale);
  if (language === "English") {
    return family;
  }

  const cacheKey = `${family.id}-${locale}`;
  if (serverHeuristicCache.has(cacheKey)) {
    const cached = serverHeuristicCache.get(cacheKey);
    // If the input family has heuristics but the cached one doesn't,
    // we should bypass the cache to fetch/translate everything.
    if (!family.heuristics || cached.heuristics) {
      return cached;
    }
  }

  try {
    logger.info(`Translating heuristic family ${family.id} (${family.name}) to ${language}...`);

    const response = await openai.responses.create({
      model: MODEL,
      stream: false,
      input: [
        {
          role: "system" as const,
          content: `You are a professional translator and UX research expert. Your task is to translate the provided UX heuristic family (including family name, family description, heuristic text definitions, short labels, category names, and violation examples) into ${language}.
Keep all technical context, short labels (like "H1", "H2"), IDs, and references exact. Return only the JSON matching the schema.`,
        },
        {
          role: "user" as const,
          content: JSON.stringify({
            id: family.id,
            name: family.name,
            description: family.description,
            heuristics: family.heuristics?.map((h: any) => ({
              id: h.id,
              heuristic: h.heuristic,
              label: h.label,
              category: h.category,
              examples: h.examples?.map((ex: any) => ({
                id: ex.id,
                title: ex.title,
                example: ex.example
              }))
            }))
          }),
        },
      ],
      text: {
        format: zodTextFormat(TranslatedFamilySchema, "translated_family"),
      },
    });

    const outputText = response.output_text?.trim();
    if (outputText) {
      const parsed = TranslatedFamilySchema.parse(JSON.parse(outputText));
      
      const translatedFamily = {
        ...family,
        name: parsed.name,
        description: parsed.description,
      };

      if (family.heuristics && parsed.heuristics) {
        translatedFamily.heuristics = family.heuristics.map((origH: any) => {
          const transH = parsed.heuristics?.find((h: any) => h.id === origH.id);
          if (!transH) return origH;

          const heuristicObj = {
            ...origH,
            heuristic: transH.heuristic,
            label: transH.label ?? origH.label,
            category: transH.category ?? origH.category,
          };

          if (origH.examples && transH.examples) {
            heuristicObj.examples = origH.examples.map((origEx: any) => {
              const transEx = transH.examples?.find((ex: any) => ex.id === origEx.id);
              if (!transEx) return origEx;
              return {
                ...origEx,
                title: transEx.title ?? origEx.title,
                example: transEx.example
              };
            });
          }

          return heuristicObj;
        });
      }

      serverHeuristicCache.set(cacheKey, translatedFamily);
      return translatedFamily;
    }
  } catch (error) {
    logger.error(`Failed to translate heuristic family ${family.id} to ${language}`, {
      error: error instanceof Error ? error.message : error
    });
  }

  return family;
}

/**
 * Translates a list of heuristic family names and descriptions in bulk.
 */
export async function translateHeuristicFamiliesList(families: any[], locale: string): Promise<any[]> {
  if (!families || families.length === 0) return families;
  if (!locale || locale.toLowerCase().startsWith("en")) {
    return families;
  }
  const language = getLanguageName(locale);
  if (language === "English") {
    return families;
  }

  const result: any[] = [];
  const toTranslate: any[] = [];

  for (const family of families) {
    const cacheKey = `${family.id}-${locale}`;
    if (serverHeuristicCache.has(cacheKey)) {
      const cached = serverHeuristicCache.get(cacheKey);
      result.push({
        ...family,
        name: cached.name,
        description: cached.description
      });
    } else {
      toTranslate.push(family);
    }
  }

  if (toTranslate.length === 0) {
    return families.map(orig => result.find(r => r.id === orig.id) || orig);
  }

  try {
    logger.info(`Translating ${toTranslate.length} heuristic families in bulk to ${language}...`);

    const response = await openai.responses.create({
      model: MODEL,
      stream: false,
      input: [
        {
          role: "system" as const,
          content: `You are a professional translator and UX research expert. Your task is to translate the names and descriptions of the provided UX heuristic families into ${language}.
Keep all IDs exact and unchanged. Return only the JSON matching the schema.`,
        },
        {
          role: "user" as const,
          content: JSON.stringify(toTranslate.map(f => ({
            id: f.id,
            name: f.name,
            description: f.description
          }))),
        },
      ],
      text: {
        format: zodTextFormat(BulkFamiliesSchema, "bulk_families"),
      },
    });

    const outputText = response.output_text?.trim();
    if (outputText) {
      const parsed = BulkFamiliesSchema.parse(JSON.parse(outputText));
      for (const transF of parsed.families) {
        const original = toTranslate.find(f => f.id === transF.id);
        const translatedFamily = {
          ...original,
          name: transF.name,
          description: transF.description
        };

        serverHeuristicCache.set(`${transF.id}-${locale}`, translatedFamily);
        result.push(translatedFamily);
      }
    } else {
      result.push(...toTranslate);
    }
  } catch (error) {
    logger.error(`Failed to translate heuristic families in bulk to ${language}`, {
      error: error instanceof Error ? error.message : error
    });
    result.push(...toTranslate);
  }

  return families.map(orig => result.find(r => r.id === orig.id) || orig);
}
