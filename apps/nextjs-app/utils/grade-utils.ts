export type Grade = "A" | "B" | "C" | "D" | "F";

export interface GradeInfo {
  grade: Grade;
  colorClass: string;
  description: string;
  /** Quality score from 0–100 (100 = no issues, 0 = worst possible). Only present for weighted scoring. */
  qualityScore?: number;
}

export interface GradeThreshold {
  grade: Grade;
  threshold: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Legacy (flat-count) grading – the default
// ---------------------------------------------------------------------------

export const LEGACY_GRADE_THRESHOLDS: GradeThreshold[] = [
  { grade: "A", threshold: "< 1", description: "Less than 1 issue per screen" },
  { grade: "B", threshold: "1 - 4", description: "1 to 4 issues per screen" },
  { grade: "C", threshold: "5 - 9", description: "5 to 9 issues per screen" },
  { grade: "D", threshold: "10 - 14", description: "10 to 14 issues per screen" },
  { grade: "F", threshold: "15+", description: "15 or more issues per screen" },
];

/**
 * Legacy grade calculation – flat issue count / screens.
 */
export function calculateGradeLegacy(
  totalIssues: number,
  totalScreens: number,
): GradeInfo {
  if (totalScreens === 0) {
    return {
      grade: "A",
      colorClass: "text-green-500",
      description: "No screens to evaluate",
    };
  }

  const issuesPerScreen = totalIssues / totalScreens;

  if (issuesPerScreen < 1) {
    return {
      grade: "A",
      colorClass: "text-green-500",
      description: "Less than 1 issue per screen",
    };
  } else if (issuesPerScreen <= 4) {
    return {
      grade: "B",
      colorClass: "text-lime-500",
      description: "1 to 4 issues per screen",
    };
  } else if (issuesPerScreen <= 9) {
    return {
      grade: "C",
      colorClass: "text-yellow-500",
      description: "5 to 9 issues per screen",
    };
  } else if (issuesPerScreen <= 14) {
    return {
      grade: "D",
      colorClass: "text-orange-500",
      description: "10 to 14 issues per screen",
    };
  } else {
    return {
      grade: "F",
      colorClass: "text-red-500",
      description: "15 or more issues per screen",
    };
  }
}

// ---------------------------------------------------------------------------
// Weighted (severity-aware) grading – opt-in via ?scoring=weighted
// ---------------------------------------------------------------------------

/**
 * Severity weights for the weighted scoring formula.
 * Maps Nielsen severity ratings (0–4) to exponential (power-of-2) multipliers.
 * Each level is 2× the previous, so impact doubles with each severity step.
 *
 * 0 = Not a problem   → 0
 * 1 = Cosmetic         → 1
 * 2 = Minor            → 2
 * 3 = Major            → 4
 * 4 = Blocker          → 8
 */
export const SEVERITY_WEIGHTS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 4,
  4: 8,
};

/** Max weight (severity 4 = Blocker), used to compute theoretical worst case */
export const MAX_SEVERITY_WEIGHT = SEVERITY_WEIGHTS[4];

/** Default weight applied when severity is null/undefined */
export const DEFAULT_SEVERITY_WEIGHT = SEVERITY_WEIGHTS[2]; // Treat unrated issues as Minor

export const WEIGHTED_GRADE_THRESHOLDS: GradeThreshold[] = [
  { grade: "A", threshold: "90 – 100%", description: "Excellent — minimal issues" },
  { grade: "B", threshold: "75 – 89%", description: "Good — minor issues only" },
  { grade: "C", threshold: "50 – 74%", description: "Fair — moderate issues" },
  { grade: "D", threshold: "25 – 49%", description: "Poor — significant issues" },
  { grade: "F", threshold: "0 – 24%", description: "Failing — critical issues" },
];

export interface ScoredIssue {
  severity?: number | null;
  violated: boolean;
}

/**
 * Calculate the total weighted severity score for a set of issues.
 */
export function calculateWeightedScore(issues: ScoredIssue[]): number {
  return issues
    .filter((issue) => issue.violated)
    .reduce((sum, issue) => {
      const severity = issue.severity ?? null;
      const weight =
        severity !== null && severity in SEVERITY_WEIGHTS
          ? SEVERITY_WEIGHTS[severity]
          : DEFAULT_SEVERITY_WEIGHT;
      return sum + weight;
    }, 0);
}

/**
 * Calculate the letter grade using a normalized quality score.
 *
 * Quality Score (0–100) = 100 × (1 − actual / theoretical_max)
 *
 * Where theoretical_max = totalHeuristics × totalScreens × MAX_SEVERITY_WEIGHT
 */
export function calculateGradeWeighted(
  issues: ScoredIssue[],
  totalScreens: number,
  totalHeuristics: number,
): GradeInfo {
  if (totalScreens === 0 || totalHeuristics === 0) {
    return {
      grade: "A",
      colorClass: "text-green-500",
      description: "No screens to evaluate",
      qualityScore: 100,
    };
  }

  const actualScore = calculateWeightedScore(issues);
  const maxPossibleScore = totalScreens * totalHeuristics * MAX_SEVERITY_WEIGHT;
  const qualityScore = Math.round(100 * (1 - actualScore / maxPossibleScore));

  if (qualityScore >= 90) {
    return { grade: "A", colorClass: "text-green-500", description: "Excellent — minimal issues", qualityScore };
  } else if (qualityScore >= 75) {
    return { grade: "B", colorClass: "text-lime-500", description: "Good — minor issues only", qualityScore };
  } else if (qualityScore >= 50) {
    return { grade: "C", colorClass: "text-yellow-500", description: "Fair — moderate issues", qualityScore };
  } else if (qualityScore >= 25) {
    return { grade: "D", colorClass: "text-orange-500", description: "Poor — significant issues", qualityScore };
  } else {
    return { grade: "F", colorClass: "text-red-500", description: "Failing — critical issues", qualityScore };
  }
}

// ---------------------------------------------------------------------------
// Convenience: pick the right thresholds for the active scoring mode
// ---------------------------------------------------------------------------

export function getGradeThresholds(useWeightedScoring: boolean): GradeThreshold[] {
  return useWeightedScoring ? WEIGHTED_GRADE_THRESHOLDS : LEGACY_GRADE_THRESHOLDS;
}
