export interface FileData {
  name: string;
  size: number;
  type: string;
  data: string;
}

// Figma metadata for files imported from Figma
export interface FigmaFileMetadata {
  figmaFileKey: string;
  figmaNodeId: string;
  figmaFrameName: string;
  figmaUrl: string;
}

// Figma comment types for posting issues to Figma
export interface FigmaIssueComment {
  fileKey: string;
  nodeId: string;
  frameName: string;
  step: number;
  issueType: string;
  issue: string;
  severity?: number | null;
  recommendations: string[];
}

export interface FigmaCommentResult {
  success: boolean;
  commentCount: number;
  errorCount: number;
  errors: Array<{ nodeId?: string; error: string }>;
}

export interface HEResultData {
  id: string;
  heuristicId: string;
  heuristicEvaluationId: string;
  violated: string;
  reason: string;
  severity?: number | null;
  rating?: "UP" | "DOWN" | null;
  source: string;
  recommendations: Array<HERecommendation>;
  heuristic: Object<Heuristic>;
  step?: number;
  fileId?: string;
}

interface Heuristic {
  id: string;
  heuristic: string;
}

interface HERecommendation {
  id: string;
  resultId: string;
  recommendation: string;
  rating?: "UP" | "DOWN" | null;
  source: $Enums.SourceType;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TeamJoinPolicy =
  | "INVITE_ONLY"
  | "SECRET"
  | "REQUEST_TO_JOIN"
  | "SELF_JOIN"
  | "AUTO_JOIN";

// Study visibility levels for sharing
export type StudyVisibility = "PRIVATE" | "TEAM" | "COMPANY";
