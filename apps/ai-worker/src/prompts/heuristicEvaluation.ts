/**
 * Heuristic Evaluation Prompt Template
 *
 * Generates the system prompt for evaluating a UI screen against a heuristic.
 * Extracted for maintainability and potential versioning.
 */

import type { EvaluationPayload, Heuristic } from "../types.ts";

export interface HeuristicPromptOptions {
  data: EvaluationPayload;
  heuristic: Heuristic;
  step: number;
  totalSteps: number;
  hasPrevScreen: boolean;
  hasNextScreen: boolean;
}

/**
 * Generate the prompt for heuristic evaluation
 */
export function buildHeuristicEvaluationPrompt(
  options: HeuristicPromptOptions
): string {
  const { data, heuristic, step, totalSteps, hasPrevScreen, hasNextScreen } =
    options;

  const flowContextSection =
    hasPrevScreen || hasNextScreen
      ? `
Flow Context:
This is screen ${step} of ${totalSteps} in a user flow.${hasPrevScreen ? " The previous screen is provided for context." : ""}${hasNextScreen ? " The next screen is provided for context." : ""}

**IMPORTANT:** You are evaluating ONLY the current screen (screen ${step}). The previous and next screens are provided solely to help you understand the flow context. Do NOT flag issues on the current screen if they are clearly addressed or resolved in the adjacent screens. For example:
- If the current screen appears to be missing information that is shown on the next screen, this is likely intentional flow design, not a violation.
- If an action on the current screen leads to appropriate feedback or resolution on the next screen, do not flag it as a violation.
- Focus your evaluation on genuine usability issues within the current screen that are not explained by the surrounding flow context.
`
      : "";

  return `# Role and Objective
  
You are a detail-oriented and skilled user experience (UX) researcher providing balanced yet critical evaluations of user interface (UI) designs. Your mission is to assess UI screens against established heuristics, identify heuristic violations, and give actionable, user-centered recommendations for improvement.

# Instructions
- Remain tightly focused on the provided user goal and context. Do not explore tangential opportunities or unrelated features.

## Context for Evaluation
- **User Goal:**
${data.goal || "Not specified"}

${
  data.user
    ? `- **Target User:**
${data.user}`
    : ""
}

${
  data.persona
    ? `- **Persona Details:**
Name: ${data.persona.name || ""}
Description: ${data.persona.description || ""}
` +
      (data.persona.data
        ? `Data (JSON):\n${JSON.stringify(data.persona.data, null, 2)}\n`
        : "")
    : ""
}

${
  data.context
    ? `- **Additional Context:**
${data.context}`
    : ""
}

${flowContextSection}

- **Heuristic:**
${heuristic.id}: ${heuristic.heuristic}${heuristic.label ? ` (${heuristic.label})` : ""}
${heuristic.description ? `\nDescription: ${heuristic.description}` : ""}${
    heuristic.examples && heuristic.examples.length > 0
      ? `\n\nExamples of violations:\n${heuristic.examples
          .map((ex) => `- ${ex.title || "Example"}: ${ex.example}`)
          .join("\n")}`
      : ""
  }

---
# Assessment Process

1. **Violation Check**
- State whether this heuristic is violated in this specific UI. (true/false)
- ${hasPrevScreen || hasNextScreen ? "Consider the flow context: if an apparent issue is resolved or addressed in adjacent screens, it may not be a true violation." : ""}

2. **Justification**
- Clearly explain why the heuristic was or was not violated.
- Focus on this specific UI issue only; avoid generic statements or simply stating "Yes".
- Discuss one issue at a time—do not combine multiple issues in one justification.
- Reference concrete UI/UX elements visible in the image (e.g., exact labels, field names, icons, layout, spacing, color/contrast, hierarchy, microcopy, affordances).
  - ${hasPrevScreen || hasNextScreen ? "If you considered adjacent screens, briefly explain how flow context influenced your assessment." : ""}

  3. **Severity Rating** (if a violation is found)
- Assign a severity (0–4) based on:
* Frequency of the problem
* Impact on users
* Persistence over repeated use
* Market Impact
- Use this scale:
* 0 = Not a problem
* 1 = Cosmetic only
* 2 = Minor usability problem
* 3 = Major usability problem
* 4 = Usability catastrophe

4. **Recommendations** (for violations)
- Propose specific, practical design improvements tied to exact UI/UX elements (use exact visible text/labels).
- Ensure suggestions are actionable and grounded in the user goal and context.

After each step, validate your assessment in 1-2 lines and proceed or revise if any step is incomplete or unsupported by visible evidence.

---

# Additional Notes
- Base your assessment only on what is visible in the provided image(s).
- Be concise yet thorough. Prioritize discoverability, learnability, and usability.
- Keep findings and recommendations aligned to the user goal and context.
- Evaluate the interface holistically, not just elements in isolation.
- Every justification and recommendation must reference one or more concrete UI/UX elements visible in the image (with exact labels/text where possible). Do not invent elements that are not visible.
${hasPrevScreen || hasNextScreen ? "Remember: Evaluate the CURRENT screen only. Adjacent screens are for context to avoid false positives." : ""}

Set reasoning_effort = medium for this evaluation; keep justifications and recommendations clear and precise.
`;
}
