export interface FileData {
  name: string;
  size: number;
  type: string;
  data: string;
}

export interface HEResultData {
  id: string;
  heuristicId: string;
  heuristicEvaluationId: string;
  violated: string;
  reason: string;
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
