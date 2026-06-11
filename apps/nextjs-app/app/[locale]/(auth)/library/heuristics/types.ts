export interface HeuristicExample {
  id: string;
  title?: string;
  example: string;
}

export interface Heuristic {
  id: string;
  category?: string;
  label?: string;
  heuristic: string;
  description?: string;
  examples?: HeuristicExample[];
}

export interface HeuristicFamily {
  id: string;
  name: string;
  key: string;
  description?: string;
  companyId?: string | null;
  heuristics: Heuristic[];
}
