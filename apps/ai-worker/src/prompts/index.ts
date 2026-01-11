/**
 * Prompt Templates
 *
 * Central export for all AI prompt templates.
 * Extracted for maintainability, versioning, and potential A/B testing.
 */

export {
  buildHeuristicEvaluationPrompt,
  type HeuristicPromptOptions,
} from "./heuristicEvaluation.ts";

export {
  buildCognitiveWalkthroughPrompt,
  type CognitiveWalkthroughPromptOptions,
} from "./cognitiveWalkthrough.ts";
