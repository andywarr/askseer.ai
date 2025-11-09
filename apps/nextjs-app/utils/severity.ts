/**
 * Severity rating utilities for usability issues
 * Based on Jakob Nielsen's severity rating scale for usability problems
 */

export type SeverityRating = 0 | 1 | 2 | 3 | 4;

export interface SeverityInfo {
  level: SeverityRating;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

const SEVERITY_DEFINITIONS: Record<SeverityRating, SeverityInfo> = {
  0: {
    level: 0,
    label: "None",
    description: "This is not a usability problem",
    color: "zinc",
    bgColor: "bg-zinc-300",
    borderColor: "border-zinc-300",
    textColor: "text-white",
  },
  1: {
    level: 1,
    label: "Cosmetic",
    description:
      "Cosmetic problem only: need not be fixed unless extra time is available",
    color: "yellow",
    bgColor: "bg-yellow-500 dark:bg-yellow-500",
    borderColor: "border-yellow-500 dark:border-yellow-500",
    textColor: "text-white",
  },
  2: {
    level: 2,
    label: "Minor",
    description:
      "Minor usability problem: fixing this should be given low priority",
    color: "amber",
    bgColor: "bg-amber-500 dark:bg-amber-500",
    borderColor: "border-amber-500 dark:border-amber-500",
    textColor: "text-white",
  },
  3: {
    level: 3,
    label: "Major",
    description:
      "Major usability problem: important to fix, should be given high priority",
    color: "orange",
    bgColor: "bg-orange-500 dark:bg-orange-500",
    borderColor: "border-orange-500 dark:border-orange-500",
    textColor: "text-white",
  },
  4: {
    level: 4,
    label: "Blocker",
    description:
      "Usability catastrophe: imperative to fix this before product can be released",
    color: "red",
    bgColor: "bg-red-500 dark:bg-red-500",
    borderColor: "border-red-500 dark:border-red-500",
    textColor: "text-white",
  },
};

/**
 * Get severity information for a given rating
 */
export function getSeverityInfo(severity?: number | null): SeverityInfo | null {
  if (severity === null || severity === undefined) {
    return null;
  }

  const level = Math.max(
    0,
    Math.min(4, Math.round(severity)),
  ) as SeverityRating;
  return SEVERITY_DEFINITIONS[level];
}

/**
 * Get a short label for the severity rating
 */
export function getSeverityLabel(severity?: number | null): string {
  const info = getSeverityInfo(severity);
  return info?.label ?? "";
}

/**
 * Get a color class for the severity rating
 */
export function getSeverityColor(severity?: number | null): string {
  const info = getSeverityInfo(severity);
  return info?.color ?? "zinc";
}

/**
 * Get background color class for the severity badge
 */
export function getSeverityBgColor(severity?: number | null): string {
  const info = getSeverityInfo(severity);
  return info?.bgColor ?? "bg-zinc-100 dark:bg-zinc-800";
}

/**
 * Get border color class for the severity badge
 */
export function getSeverityBorderColor(severity?: number | null): string {
  const info = getSeverityInfo(severity);
  return info?.borderColor ?? "border-zinc-300 dark:border-zinc-700";
}

/**
 * Get text color class for the severity badge
 */
export function getSeverityTextColor(severity?: number | null): string {
  const info = getSeverityInfo(severity);
  return info?.textColor ?? "text-zinc-900 dark:text-zinc-100";
}

/**
 * Sort issues by severity (highest first)
 */
export function sortBySeverity<T extends { severity?: number | null }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const severityA = a.severity ?? -1;
    const severityB = b.severity ?? -1;
    return severityB - severityA;
  });
}
