/**
 * Cognitive Walkthrough Prompt Template
 *
 * Generates the system prompt for evaluating a UI step in a cognitive walkthrough.
 * Extracted for maintainability and potential versioning.
 */

import type { EvaluationPayload, CWQuestion } from "../types.ts";
import { getLanguageName } from "./utils";
import { wrapInXml, PROMPT_SAFETY_INSTRUCTIONS } from "../lib/safety.ts";

export interface CognitiveWalkthroughPromptOptions {
  data: EvaluationPayload;
  questions: CWQuestion[];
  step: number;
  totalSteps: number;
  lastLlmResponse: string;
}

/**
 * Generate the prompt for cognitive walkthrough
 */
export function buildCognitiveWalkthroughPrompt(
  options: CognitiveWalkthroughPromptOptions,
): string {
  const { data, questions, step, totalSteps, lastLlmResponse } = options;

  const languageName = getLanguageName(data.locale);
  const languageInstruction = languageName !== "English"
    ? `
- **CRITICAL:** You must write all output text, including the answers to the evaluation questions, the identified issues, and all recommendations, natively in **${languageName}**. Do NOT use English for explanations, answers, or recommendations.
`
    : "";

  // Build benchmark context section if prior issues exist
  const benchmarkIssues = data.benchmarkContext?.issues ?? [];
  const benchmarkSection =
    benchmarkIssues.length > 0
      ? `
## Prior Benchmark Issues
${
  data.benchmarkContext?.mode === "flow"
    ? `These issues were found in a **previous version of this flow** with different screens. Use them as general design-debt context — note if the new flow has addressed them overall, but do not assume they map to any specific step position.`
    : `These issues were found in a **previous run of this same flow** with identical screens. Assess whether each issue still persists at this step.`
}

${benchmarkIssues
  .map(
    (issue, i) =>
      `Prior Issue ${i + 1}:
- Type: ${issue.issueType ?? "Unknown"}
- Issue: ${issue.issue ?? "N/A"}
- Severity: ${issue.severity ?? "unrated"}
${issue.recommendations && issue.recommendations.length > 0 ? `- Prior recommendations:\n${issue.recommendations.map((rec) => `  * ${rec}`).join("\n")}` : ""}`,
  )
  .join("\n\n")}

When evaluating this step, explicitly note whether each prior issue has been addressed or still persists.
`
      : "";

  return `# Role and Objective
  
You are a detail-oriented, skilled user experience researcher assigned to critically evaluate user flows and interface designs via a cognitive walkthrough. Your main goal is to identify discoverability, learnability, and usability issues at each step, and to offer practical, actionable recommendations for improvement.

# Instructions

- Stay focused on helping the user accomplish the stated goal. Avoid assessing tangential opportunities or unrelated features.
- **Standard UI Shell & Global Elements:** Do NOT flag standard global page elements (such as headers, footers, search bars, global navigation links, brand logos, account/profile menus, or sidebars) as visual clutter, competing elements, or usability issues simply because they are not required to complete the specific user goal. These standard shell elements are expected conventions on web/app interfaces. Only flag them if they are genuinely poorly designed, broken, misleading, or physically obstructing/blocking the user from completing their task (e.g., a modal overlay or an obtrusive banner blocking the target element).
${languageInstruction}

- **Safety Warning:** ${PROMPT_SAFETY_INSTRUCTIONS}

---

## Evaluation Context

**This is Step ${step + 1} of ${totalSteps + 1} in the user flow.**
  
- **User Goal:**
${wrapInXml("user_goal", data.goal || "Not specified")}

${
  data.user
    ? `- **Target User:**
${wrapInXml("target_user", data.user)}`
    : ""
}

${
  data.persona
    ? `- **Persona Details:**
${wrapInXml(
  "persona_details",
  [
    `Name: ${data.persona.name || ""}`,
    `Description: ${data.persona.description || ""}`,
    data.persona.data ? `Data (JSON):\n${JSON.stringify(data.persona.data, null, 2)}` : ""
  ].filter(Boolean).join("\n")
)}`
    : ""
}

${
  data.context
    ? `- **Additional Context:**
${wrapInXml("additional_context", data.context)}`
    : ""
}

${
  lastLlmResponse
    ? `- **User Expectation from Previous Step:**  
  ${lastLlmResponse}`
    : ""
}

${benchmarkSection}

---

For this step, answer these questions based **only** on the provided UI image:

${questions.map((question) => `Question ID: "${question.id}"\nQuestion: ${question.question}`).join("\n\n")}

---

## Assessment Instructions

**Target User Focus:**
- Anchor every answer and recommendation to the target user's needs, abilities, and above context. If no user details are given, proceed with general assumptions only.

1. **Expectation Alignment**
- Did this step match what was anticipated based on prior expectations?

2. **Answer the Evaluation Questions**
- Respond thoroughly to every question above, referencing specific visual UI/UX elements (exact button labels, field names, icons, positions, etc.). Avoid generic feedback.

3. **Discoverability**
- Identify any obstacles to the user noticing or understanding how to progress at this step. Directly reference involved UI/UX elements using their exact visible text/label and describe their position.
- For each issue, give a clear, element-specific, actionable recommendation.

4. **Learnability**
- Note anything that may confuse first-time users or that needs prior knowledge. Reference specific UI/UX elements, explaining why they're confusing for the target user.
- Offer concrete, element-level recommendations (e.g., new copy, better labels, repositioning).

5. **Usability**
- Highlight any efficiency/friction issues in performing the intended action. Cite the involved elements/interactions, and provide actionable fixes.

6. **Severity Rating** (if a violation is found)
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
   
After completing your assessment of the UI image, provide a brief validation that your analysis aligns with the user's goal and the assessment scope, and highlight any next steps or actions needed for clarification or refinement.

---

# Additional Notes
- Assess only what is visible in the supplied image.
- Be concise but thorough; prioritize discoverability, learnability, and usability.
- Give actionable, practical improvement recommendations for each issue found.
- Every issue, justification, and recommendation **must reference one or more concrete UI/UX elements visible in the image** (by name/label if available). Do not invent invisible elements.
- Stay strictly aligned with the stated user goal and context; ignore unrelated features or concerns. However, do NOT treat the mere presence of standard page layout shell elements (headers, navigation, footers, search bars) as distractions or usability issues.
- Evaluate the entire interface's interaction for this step, not just single components.
Describe your use case, desired behavior, and issues
`;
}
