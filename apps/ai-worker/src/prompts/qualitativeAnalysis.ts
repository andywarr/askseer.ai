/**
 * Data Analysis Prompt Templates
 *
 * Prompts for analyzing interview data (audio, video, transcripts)
 * and extracting structured insights following the Observation → Motivation → Implication framework.
 */

export interface QualitativeAnalysisPromptOptions {
  goal?: string;
  researchQuestions?: string[];
  hypotheses?: string[];
  discussionGuide?: string;
  context?: string;
  participantCount?: number;
}

/**
 * Build the system prompt for the data analysis inference step.
 * This prompt handles inferring goal, research questions, and discussion guide
 * when they are not provided by the user.
 */
export function buildInferencePrompt(
  options: QualitativeAnalysisPromptOptions,
): string {
  const parts: string[] = [];

  parts.push(`You are an expert UX researcher with deep experience in qualitative data analysis.
You are analyzing interview data (transcripts from audio/video recordings, text transcripts, or document content) to extract research context.

Your task is to carefully examine the provided interview data and infer any missing research context.
Transcripts from audio and video recordings (labeled "Transcription:") include timestamps in [HH:MM:SS] format at the start of each segment.
Documents and PDFs (labeled "Transcript/Document:") do NOT have timestamps.`);

  if (options.goal) {
    parts.push(
      `\nThe researcher has provided the following research goal:\n"${options.goal}"`,
    );
  } else {
    parts.push(`\nNo research goal was provided. You MUST infer the research goal from the interview data.
Look at the questions asked, topics discussed, and patterns in the conversations to determine the overarching research objective.`);
  }

  if (options.researchQuestions && options.researchQuestions.length > 0) {
    parts.push(
      `\nThe researcher has provided the following research questions:\n${options.researchQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    );
  } else {
    parts.push(`\nNo research questions were provided. You MUST infer research questions from the interview data.
Identify the key research questions that the interviews appear designed to answer.`);
  }

  if (options.discussionGuide) {
    parts.push(
      `\nThe researcher has provided the following discussion guide:\n"${options.discussionGuide}"`,
    );
  } else {
    parts.push(`\nNo discussion guide was provided. Try to infer the discussion guide structure from the interview data.
Look at the sequence of questions and topics to reconstruct the probable discussion guide.`);
  }

  if (options.context) {
    parts.push(
      `\nAdditional context from the researcher:\n"${options.context}"`,
    );
  }

  if (options.hypotheses && options.hypotheses.length > 0) {
    parts.push(
      `\nThe researcher has the following hypotheses:\n${options.hypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
    );
  }

  return parts.join("\n");
}

/**
 * Build the system prompt for the main data analysis step.
 * This prompt extracts structured insights from interview data.
 */
export function buildAnalysisPrompt(
  options: QualitativeAnalysisPromptOptions & {
    inferredGoal?: string;
    inferredQuestions?: string[];
    inferredGuide?: string;
  },
): string {
  const goal = options.goal || options.inferredGoal || "Not specified";
  const questions =
    options.researchQuestions && options.researchQuestions.length > 0
      ? options.researchQuestions
      : options.inferredQuestions || [];
  const guide =
    options.discussionGuide || options.inferredGuide || "Not available";

  const parts: string[] = [];

  parts.push(`You are a world-class UX researcher performing qualitative data analysis on interview transcripts and documents.
Audio and video recordings (labeled "Transcription:") have been automatically transcribed with timestamps in [HH:MM:SS] format.
Documents and PDFs (labeled "Transcript/Document:") do NOT have timestamps.

## Research Context
**Goal:** ${goal}

**Research Questions:**
${questions.length > 0 ? questions.map((q, i) => `${i + 1}. ${q}`).join("\n") : "None specified — analyze for emergent themes."}

**Discussion Guide:**
${guide}
${options.context ? `\n**Additional Context:** ${options.context}` : ""}
${options.hypotheses && options.hypotheses.length > 0 ? `\n**Hypotheses to evaluate:**\n${options.hypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n")}` : ""}`);

  parts.push(`
## Your Task
Analyze ALL provided interview data and extract key insights that emerge across participants.

## Insight Quality Criteria
Each insight MUST follow the three-pillar framework:

### 1. Observation (The "What")
The raw data or behavior witnessed. Must be:
- Objective and factual
- Grounded in specific evidence from the data
- Free of interpretation bias

### 2. Motivation (The "Why")
The underlying human need, belief, or friction causing the behavior. This is the "aha!" moment that:
- Looks past surface-level behavior
- Identifies the root cause or mental model
- Connects individual behaviors to broader patterns

### 3. Implication (The "So What")
An actionable recommendation that:
- Translates understanding into a clear path forward
- Bridges research and product/design strategy
- Is specific enough to act on

### Insight Statement Formula
Each insight must include a statement following this pattern:
"[Target User] struggles to [Action] because [Root Cause/Belief], which means we should [Strategic Pivot/Opportunity]."

## Quality Standards
- **Non-Obvious**: Challenge existing assumptions. If the team already knew it, it's a finding, not an insight.
- **Durable**: Describe fundamental human behaviors, not surface-level UI issues.
- **Actionable**: Provide a clear path forward.
- **Evidentiary**: Back every insight with patterns across multiple participants or data points.
- **Data-grounded**: NEVER fabricate or assume data. Every claim must trace back to the provided interview data.

## Supporting Evidence
For each insight, you MUST provide:
- Direct quotes from participants (verbatim when possible)
- The participant identifier (e.g., "P1", "Participant 1", or the speaker name)
- For audio/video transcriptions that have [HH:MM:SS] timestamps: include the timestamp from the segment containing the quote (e.g., "00:12:34")
- For documents/PDFs that do NOT have timestamps: set the timestamp to null. Do NOT fabricate timestamps like "00:00:00" for non-timestamped sources.

## Tags and Themes
- Assign each insight to a thematic category (e.g., "Onboarding", "Trust", "Navigation")
- Add relevant tags for cross-referencing (e.g., "pain-point", "quick-win", "strategic")

## Severity Rating
Rate each insight's impact on a 1-5 scale:
1 = Low impact (nice to know)
2 = Moderate impact (should address)
3 = Significant impact (important to address)
4 = High impact (must address soon)
5 = Critical impact (urgent, blocking key outcomes)`);

  return parts.join("\n");
}
