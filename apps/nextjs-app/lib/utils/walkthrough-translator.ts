import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { logger } from "@/apps/shared/logger";
import { getLanguageName } from "./heuristic-translator";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "mock-key-for-testing",
  dangerouslyAllowBrowser: true,
});

const MODEL = process.env.TRANSLATION_MODEL ?? "gpt-4o-mini";

// Process memory cache for server-side cognitive walkthrough questions translations
// Key: `${questionId}-${locale}`
const serverQuestionCache = new Map<string, any>();

/**
 * Clears the server-side walkthrough questions translation cache.
 * Primarily used in unit tests.
 */
export function clearQuestionCache(): void {
  serverQuestionCache.clear();
}

const BulkQuestionsSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    question: z.string()
  }))
});

/**
 * Translates a list of cognitive walkthrough questions in bulk.
 */
export async function translateCWQuestionsList(questions: any[], locale: string): Promise<any[]> {
  if (!questions || questions.length === 0) return questions;
  if (!locale || locale.toLowerCase().startsWith("en")) {
    return questions;
  }
  const language = getLanguageName(locale);
  if (language === "English") {
    return questions;
  }

  const result: any[] = [];
  const toTranslate: any[] = [];

  for (const q of questions) {
    const cacheKey = `${q.id}-${locale}`;
    if (serverQuestionCache.has(cacheKey)) {
      const cached = serverQuestionCache.get(cacheKey);
      result.push({
        ...q,
        question: cached.question
      });
    } else {
      toTranslate.push(q);
    }
  }

  if (toTranslate.length === 0) {
    return questions.map(orig => result.find(r => r.id === orig.id) || orig);
  }

  try {
    logger.info(`Translating ${toTranslate.length} cognitive walkthrough questions to ${language}...`);

    const response = await openai.responses.create({
      model: MODEL,
      stream: false,
      input: [
        {
          role: "system" as const,
          content: `You are a professional translator and UX research expert. Your task is to translate the provided cognitive walkthrough questions into ${language}.
Keep all IDs exact and unchanged. Return only the JSON matching the schema.`,
        },
        {
          role: "user" as const,
          content: JSON.stringify(toTranslate.map(q => ({
            id: q.id,
            question: q.question
          }))),
        },
      ],
      text: {
        format: zodTextFormat(BulkQuestionsSchema, "bulk_questions"),
      },
    });

    const outputText = response.output_text?.trim();
    if (outputText) {
      const parsed = BulkQuestionsSchema.parse(JSON.parse(outputText));
      for (const transQ of parsed.questions) {
        const original = toTranslate.find(q => q.id === transQ.id);
        const translatedQuestion = {
          ...original,
          question: transQ.question
        };

        serverQuestionCache.set(`${transQ.id}-${locale}`, translatedQuestion);
        result.push(translatedQuestion);
      }
    } else {
      result.push(...toTranslate);
    }
  } catch (error) {
    logger.error(`Failed to translate walkthrough questions in bulk to ${language}`, {
      error: error instanceof Error ? error.message : error
    });
    result.push(...toTranslate);
  }

  return questions.map(orig => result.find(r => r.id === orig.id) || orig);
}
