"use server";

import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { requireAuth, ActionResult, actionSuccess, actionError } from "@/apps/nextjs-app/lib/actions/shared";
import { logger } from "@/apps/shared/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.TRANSLATION_MODEL ?? "gpt-4o-mini";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  fr: "French",
};

/**
 * Translates a given block of text to the target user locale on-demand.
 * This runs securely on the server side using OpenAI.
 */
export async function translateText(
  text: string,
  targetLocale: string,
): Promise<ActionResult<{ translatedText: string }>> {
  try {
    const user = await requireAuth();

    if (!text || !text.trim()) {
      return actionSuccess({ translatedText: "" });
    }

    if (text.length > 10000) {
      return actionError("Text exceeds maximum length of 10,000 characters");
    }

    logger.debug("Translating text on demand", {
      userId: user.id,
      targetLocale,
      textLength: text.length,
    });

    const targetLanguage = LANGUAGE_NAMES[targetLocale] || targetLocale;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Your task is to translate the user's text into the target language: ${targetLanguage}.
Ensure the translation is natural, contextually accurate, and suitable for a professional user experience (UX) research tool.
Maintain any formatting, markdown, tags, or punctuation.
If the text is already in the target language or does not require translation, return it exactly as is.
Do not add any introductory or explanatory text. Return only the translated text itself.`
        },
        {
          role: "user",
          content: text,
        }
      ],
      temperature: 0.3,
    });

    const translatedText = response.choices[0]?.message?.content?.trim() || text;

    return actionSuccess({ translatedText });
  } catch (error) {
    logger.error("Failed to translate text", {
      text,
      targetLocale,
      error,
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to translate text",
    );
  }
}

const BulkMessagesSchema = z.object({
  translations: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    })
  ),
});

/**
 * Translates a list of message objects in bulk to the target locale.
 * Runs securely on the server side using OpenAI structured outputs.
 */
export async function translateMessages(
  messages: Array<{ id: string; text: string }>,
  targetLocale: string,
): Promise<ActionResult<Array<{ id: string; translatedText: string }>>> {
  try {
    const user = await requireAuth();

    if (!messages || messages.length === 0) {
      return actionSuccess([]);
    }

    if (messages.length > 50) {
      return actionError("Cannot translate more than 50 messages at once");
    }

    const targetLanguage = LANGUAGE_NAMES[targetLocale] || targetLocale;

    logger.debug("Translating messages in bulk", {
      userId: user.id,
      targetLocale,
      messageCount: messages.length,
    });

    const response = await openai.responses.create({
      model: MODEL,
      stream: false,
      input: [
        {
          role: "system" as const,
          content: `You are a professional translator and UX research expert. Your task is to translate the provided messages into ${targetLanguage}.
Keep all IDs exact and unchanged. Return only the JSON matching the schema. Maintain formatting, tone, and context.`,
        },
        {
          role: "user" as const,
          content: JSON.stringify(messages.map((m) => ({ id: m.id, text: m.text }))),
        },
      ],
      text: {
        format: zodTextFormat(BulkMessagesSchema, "bulk_messages"),
      },
    });

    const outputText = response.output_text?.trim();
    if (outputText) {
      const parsed = BulkMessagesSchema.parse(JSON.parse(outputText));
      const translated = parsed.translations.map((t) => ({
        id: t.id,
        translatedText: t.text,
      }));
      return actionSuccess(translated);
    }

    return actionError("Translation output was empty");
  } catch (error) {
    logger.error("Failed to translate messages in bulk", {
      targetLocale,
      error,
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to translate messages",
    );
  }
}
