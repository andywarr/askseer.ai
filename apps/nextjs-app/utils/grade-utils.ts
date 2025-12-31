export type Grade = "A" | "B" | "C" | "D" | "F";

export interface GradeInfo {
  grade: Grade;
  colorClass: string;
  description: string;
}

export interface GradeThreshold {
  grade: Grade;
  threshold: string;
  description: string;
}

export const GRADE_THRESHOLDS: GradeThreshold[] = [
  { grade: "A", threshold: "< 1", description: "Less than 1 issue per screen" },
  { grade: "B", threshold: "1 - 4", description: "1 to 4 issues per screen" },
  { grade: "C", threshold: "5 - 9", description: "5 to 9 issues per screen" },
  { grade: "D", threshold: "10 - 14", description: "10 to 14 issues per screen" },
  { grade: "F", threshold: "15+", description: "15 or more issues per screen" },
];

export function calculateGrade(
  totalIssues: number,
  totalScreens: number,
): GradeInfo {
  // Handle edge case of no screens
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
