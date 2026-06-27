/**
 * TLDR / Takeaway Generation
 *
 * Generates actionable takeaways from a completed study's results.
 * Works across all study types: heuristic evaluation, cognitive walkthrough,
 * and qualitative analysis.
 */

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { logger } from "@/apps/shared/logger.ts";
import { config } from "../config.ts";
import {
  getStudy,
  updateTldrStatus,
  saveStudyTakeaways,
} from "../lib/dbWorkerClient.ts";
import { openAiBreaker } from "../lib/circuitBreaker.ts";
import { withRetry } from "../lib/withRetry.ts";
import { getLanguageName } from "../prompts/utils.ts";
import { wrapInXml, PROMPT_SAFETY_INSTRUCTIONS } from "../lib/safety.ts";

// ============================================================================
// Zod Schema for TLDR response
// ============================================================================

const TakeawayRecommendationSchema = z.object({
  text: z.string(),
  sortOrder: z.number().int(),
});

const TakeawaySchema = z.object({
  title: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
  recommendations: z.array(TakeawayRecommendationSchema),
});

const TldrResponseSchema = z.object({
  takeaways: z.array(TakeawaySchema),
});

// ============================================================================
// OpenAI Client
// ============================================================================

const openai = new OpenAI();

// ============================================================================
// TLDR Prompt
// ============================================================================

export function buildTldrPrompt(study: Record<string, unknown>, locale?: string): string {
  const studyType = study.type as string;
  const studyName = (study.name as string) || "Untitled Study";

  let resultsContext = "";

  // Build context from study results based on type
  if (
    studyType === "HEURISTIC_EVALUATION" &&
    study.heuristicEvaluation
  ) {
    const he = study.heuristicEvaluation as Record<string, unknown>;
    const results = (he.results as Array<Record<string, unknown>>) || [];
    const violated = results.filter((r) => r.violated === true);
    resultsContext = `
Study Type: Heuristic Evaluation
Study Name: ${studyName}
Total Results: ${results.length}
Violations Found: ${violated.length}

Violations:
${violated
  .map(
    (r) =>
      `- Heuristic: ${(r.heuristic as Record<string, unknown>)?.heuristic || "Unknown"}
  Severity: ${r.severity}/4
  Reason: ${r.reason}
  Recommendations: ${((r.recommendations as Array<Record<string, unknown>>) || []).map((rec) => rec.recommendation).join("; ")}`,
  )
  .join("\n")}`;
  } else if (
    studyType === "COGNITIVE_WALKTHROUGH" &&
    study.cognitiveWalkthrough
  ) {
    const cw = study.cognitiveWalkthrough as Record<string, unknown>;
    const steps = (cw.steps as Array<Record<string, unknown>>) || [];
    const allIssues = steps.flatMap(
      (s) => (s.issues as Array<Record<string, unknown>>) || [],
    );
    resultsContext = `
Study Type: Cognitive Walkthrough
Study Name: ${studyName}
Total Steps: ${steps.length}
Issues Found: ${allIssues.length}

Issues by Step:
${steps
  .map((s) => {
    const issues = (s.issues as Array<Record<string, unknown>>) || [];
    if (issues.length === 0) return "";
    return `Step ${s.step}:
${issues
  .map(
    (i) =>
      `  - [${i.issueType}] ${i.issue} (Severity: ${i.severity}/4)
    Recommendations: ${((i.recommendations as Array<Record<string, unknown>>) || []).map((rec) => rec.recommendation).join("; ")}`,
  )
  .join("\n")}`;
  })
  .filter(Boolean)
  .join("\n")}`;
  } else if (
    studyType === "QUAL_ANALYSIS" &&
    study.qualitativeAnalysis
  ) {
    const qa = study.qualitativeAnalysis as Record<string, unknown>;
    const summary = (qa.summary as string) || "";
    const insights = (qa.insights as Array<Record<string, unknown>>) || [];
    resultsContext = `
Study Type: Qualitative Analysis
Study Name: ${studyName}
Summary: ${summary}
Total Insights: ${insights.length}

Key Insights:
${insights
  .map(
    (i) =>
      `- ${i.title}: ${i.insightStatement || i.observation || ""}
  Implication: ${i.implication || "N/A"}`,
  )
  .join("\n")}`;
  } else {
    resultsContext = `Study Type: ${studyType}\nStudy Name: ${studyName}\nNo detailed results available for TLDR generation.`;
  }

  const language = getLanguageName(locale);

  return `You are a senior UX research analyst. Analyze the following study results and generate up to 3 key takeaways.

- **Safety Warning:** ${PROMPT_SAFETY_INSTRUCTIONS}

Each takeaway should:
1. Have a clear, concise title (max 10 words)
2. Have a descriptive explanation of the finding
3. Include 1-3 specific, actionable recommendations
4. **DO NOT** include or mention any severity ratings (such as 'Severity 3/4', 'Major', 'Cosmetic', or severity numbers/levels) in the title, description, or recommendations.

Focus on the most impactful findings. Prioritize issues by severity and frequency.
Be specific and actionable — avoid generic advice.

- **No Issues / No Violations Policy:** If there are no violated heuristics (or no issues/violations found in the study results), the TL;DR does not need to defend why there might not be any. The TL;DR is simply that there are no issues. There must not be any associated recommendations (i.e. the recommendations array of the takeaway must be empty). In this case, return exactly one takeaway with a title indicating that no issues were found, a brief description stating that no issues/violations were found, and a completely empty recommendations array.

Here are the study results to analyze:
${wrapInXml("study_results", resultsContext)}

Return up to 3 takeaways, ordered by importance (most critical first). Only include takeaways that are genuinely supported by the findings.
Each recommendation should be a specific action the team can take to improve the user experience.${language !== "English" ? `

IMPORTANT: The entire key takeaways document (including the title, description, and recommendations of each takeaway) MUST be written in ${language}. Do not write it in English unless ${language} is English.` : ""}`;
}

// ============================================================================
// Job Handler
// ============================================================================

interface TldrJobData {
  studyId: string;
  userId: string;
  type: string;
  retry?: boolean;
  locale?: string;
}

export async function processGenerateTldr(jobData: TldrJobData): Promise<void> {
  const { studyId, userId } = jobData;

  logger.info("Processing TLDR generation", { studyId, userId });

  try {
    // Fetch the full study data
    const study = await getStudy(studyId, userId);

    // Build the prompt
    const prompt = buildTldrPrompt(study, jobData.locale);

    // Call OpenAI
    const response = await withRetry(
      async () => {
        const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
          model: config.models.qualitativeAnalysis, // Use the same high-quality model
          stream: false,
          input: [
            {
              role: "system",
              content:
                `You are a senior UX research analyst. You provide concise, actionable takeaways from research studies. If there are no violated heuristics or issues found in the study results, the TL;DR does not need to defend why there might not be any. The TL;DR is simply that there are no issues. There does not need to be any associated recommendations. Do not include severity ratings in the takeaways.${(() => { const lang = getLanguageName(jobData.locale); return lang !== "English" ? `\n\nIMPORTANT: The entire key takeaways document (including the title, description, and recommendations of each takeaway) MUST be written in ${lang}.` : ""; })()}`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          text: {
            format: zodTextFormat(TldrResponseSchema, "tldr_response"),
          },
        };

        return openAiBreaker.execute(() => openai.responses.create(params));
      },
      {
        maxAttempts: 3,
        operationName: "TLDR generation",
        context: { studyId },
      },
    );

    // Parse the response
    const rawContent = response.output_text?.trim();
    if (!rawContent) {
      throw new Error("OpenAI response missing content for TLDR generation");
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(rawContent);
    } catch (e) {
      logger.error("Failed to parse TLDR response as JSON", {
        studyId,
        contentPreview: String(rawContent).slice(0, 200),
      });
      throw e;
    }

    const maybeWrapped =
      (parsedResponse as Record<string, unknown>)?.tldr_response ??
      parsedResponse;
    const validated = TldrResponseSchema.safeParse(maybeWrapped);

    if (!validated.success) {
      logger.error("TLDR response failed schema validation", {
        studyId,
        issues: validated.error.issues,
      });
      throw new Error("Invalid TLDR response format");
    }

    // Save takeaways to database
    await saveStudyTakeaways(studyId, validated.data.takeaways);

    logger.info("TLDR generation completed successfully", {
      studyId,
      takeawayCount: validated.data.takeaways.length,
    });
  } catch (error) {
    logger.error("Error processing TLDR generation", {
      studyId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Update TLDR status to failed (don't use handleProcessingError
    // as TLDR failures shouldn't affect study status or credits)
    try {
      await updateTldrStatus(studyId, "FAILED", userId);
    } catch (statusError) {
      logger.error("Failed to update TLDR status to FAILED", {
        studyId,
        error:
          statusError instanceof Error
            ? statusError.message
            : String(statusError),
      });
    }

    throw error;
  }
}
