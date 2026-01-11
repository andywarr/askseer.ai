/**
 * Shared type definitions for ai-worker
 * Consolidates types used across multiple modules
 */

// ============================================================================
// File Types
// ============================================================================

/**
 * File record from the database
 */
export interface File {
  id: string;
  name: string;
  key: string | null;
  size: number;
  type: string;
}

// ============================================================================
// Heuristic Evaluation Types
// ============================================================================

/**
 * Heuristic definition from the database
 */
export interface Heuristic {
  id: string;
  heuristic: string;
  label?: string;
  description?: string;
  examples?: Array<{
    id: string;
    title?: string;
    example: string;
  }>;
}

/**
 * Result data from a single heuristic evaluation
 */
export interface HEResultData {
  id: string;
  heuristic: string;
  violated: boolean;
  reason: string;
  severity: number;
  recommendations: Array<{ recommendation: string }>;
  fileId?: string;
  step?: number;
}

/**
 * Options for the evaluate function
 */
export interface EvaluateOptions {
  image_url: string;
  prompt: string;
  prevImageUrl?: string;
  nextImageUrl?: string;
}

// ============================================================================
// Cognitive Walkthrough Types
// ============================================================================

/**
 * Result data for a single question in a CW step
 */
export interface CWResultData {
  questionId: string;
  answer: string;
}

/**
 * Recommendation data for a CW issue
 */
export interface CWRecommendationData {
  recommendation: string;
}

/**
 * Issue data for a CW step
 */
export interface CWIssueData {
  issueType: string;
  issue: string;
  severity: number;
  recommendations: Array<CWRecommendationData>;
}

/**
 * Step data for a cognitive walkthrough
 */
export interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

/**
 * CW Question from the database
 */
export interface CWQuestion {
  id: string;
  question: string;
}

// ============================================================================
// Deduplication Types
// ============================================================================

/**
 * Item used in deduplication processing
 */
export interface DeduplicationItem {
  text: string;
  originalIndex: number;
}

// ============================================================================
// Persona Types
// ============================================================================

/**
 * Persona data structure
 */
export interface PersonaData {
  name?: string;
  description?: string;
  oneLiner?: string;
  images?: {
    photoKey?: string;
    coverKey?: string;
  };
  [key: string]: unknown;
}

/**
 * Persona payload in job data
 */
export interface PersonaPayload {
  data?: PersonaData;
  photoUrl?: string;
  coverUrl?: string;
  [key: string]: unknown;
}

// ============================================================================
// Job Payload Types (for stronger typing in getPrompt)
// ============================================================================

/**
 * Common payload fields for evaluation jobs
 */
export interface EvaluationPayload {
  goal?: string;
  user?: string | null;
  context?: string | null;
  persona?: {
    name?: string;
    description?: string;
    data?: Record<string, unknown>;
  };
  heuristic?: string;
}
