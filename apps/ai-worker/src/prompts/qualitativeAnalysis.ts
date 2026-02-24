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
    codebook?: Array<{ name: string; definition: string; codes: string[] }>;
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

  // Codebook constraint: if provided, force insights to use these themes
  if (options.codebook && options.codebook.length > 0) {
    parts.push(`
## Codebook (Use these themes — do NOT invent new ones)
${options.codebook.map((t, i) => `${i + 1}. **${t.name}**: ${t.definition}\n   Codes: ${t.codes.join(", ")}`).join("\n")}

Assign each insight to exactly one theme from the codebook above. Use the theme name verbatim as the insight's \`theme\` field.`);
  }

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
- Add relevant tags for cross-referencing as short, lowercase, hyphenated labels (e.g., "pain-point", "quick-win", "strategic")
- Do NOT prefix tags with "category:", "type:", or any other namespace — just the label itself

## Severity Rating
Rate each insight's impact on a 1-5 scale:
1 = Low impact (nice to know)
2 = Moderate impact (should address)
3 = Significant impact (important to address)
4 = High impact (must address soon)
5 = Critical impact (urgent, blocking key outcomes)`);

  return parts.join("\n");
}

/**
 * Build the system prompt for the codebook generation step.
 * This prompt performs open coding on transcripts to produce a fixed set of
 * themes and codes before the main analysis.
 */
export function buildCodebookPrompt(
  options: QualitativeAnalysisPromptOptions & {
    inferredGoal?: string;
    inferredQuestions?: string[];
  },
): string {
  const goal = options.goal || options.inferredGoal || "Not specified";
  const questions =
    options.researchQuestions && options.researchQuestions.length > 0
      ? options.researchQuestions
      : options.inferredQuestions || [];

  return `You are an expert qualitative researcher performing open coding on interview transcripts.

## Research Context
**Goal:** ${goal}
${questions.length > 0 ? `**Research Questions:**\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : ""}
${options.context ? `**Additional Context:** ${options.context}` : ""}

## Your Task
Read ALL provided interview data and generate a codebook — a structured set of themes with definitions and specific codes.

This codebook will be used to constrain the main analysis step, ensuring consistent theme naming across multiple analysis runs.

## Guidelines
- Identify 5-15 themes that capture the key patterns in the data
- Each theme should have a clear, concise name (2-4 words)
- Each theme should have a one-sentence definition
- Each theme should have 2-6 specific codes (sub-categories or labels)
- Themes should be mutually exclusive where possible
- Themes should collectively cover the major patterns in the data
- Use language grounded in the transcripts, not abstract academic terminology
- Order themes by importance/prevalence`;
}

/**
 * Build the system prompt for the consolidation step.
 * This prompt merges insights from N independent analysis runs by consensus.
 */
export function buildConsolidationPrompt(
  runCount: number,
  consensusThreshold: number,
): string {
  return `You are an expert UX researcher tasked with consolidating insights from ${runCount} independent analyses of the same interview data.

## Your Task
You are given ${runCount} separate analysis results, each containing insights with supporting evidence. Your job is to produce a single, authoritative set of insights by consensus.

## Consolidation Rules
1. **Consensus threshold**: Keep an insight only if a substantially similar insight appears in at least ${consensusThreshold} of the ${runCount} analyses. Two insights are "substantially similar" if they describe the same underlying observation, even if worded differently.
2. **Merge, don't duplicate**: When multiple runs surface the same insight, merge them into the best-evidenced version. Pick the clearest observation, motivation, and implication. Combine supporting quotes from all runs (deduplicating exact duplicates).
3. **Evidence quality**: Prefer the version with more direct quotes and specific participant references. If one run has a quote that perfectly illustrates the point, use that one.
4. **Remove weak insights**: Discard any insight that:
   - Appears in only ${consensusThreshold - 1 > 0 ? consensusThreshold - 1 : "zero"} or fewer runs
   - Has no supporting quotes
   - Is vague or obvious (e.g., "users want a better experience")
5. **Preserve structure**: The final output must follow the exact same schema as the individual runs — each insight should have title, observation, motivation, implication, insightStatement, theme, severity, participantCount, quotes, and tags.
6. **Severity consensus**: Use the median severity across runs for each merged insight.
7. **Theme consistency**: Use consistent theme names. If different runs used slightly different names for the same theme, pick the most descriptive one.
8. **Never reference the analysis process**: The output must read as a single authoritative analysis. NEVER mention or reference the number of analyses, runs, or passes (e.g., do NOT write "across the three analyses" or "all analyses agreed"). Write as if this is the only analysis that was ever performed.

## Output
Produce a single consolidated analysis with:
- A **summary** that synthesizes the key findings (do NOT reference the number of analyses or the consolidation process)
- A merged, deduplicated set of **insights** meeting the consensus threshold`;
}
