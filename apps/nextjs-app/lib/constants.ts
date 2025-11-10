// Shared enum for menu surfaces.
// Kept in a non-client module so server and client components can import it safely.
export enum MenuSurface {
  EVALUATION = "EVALUATION",
  WALKTHROUGH = "WALKTHROUGH",
  PERSONA = "PERSONA",
}

export const TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES = 10;
export const TEAM_WITH_COMPANY_MAX_STUDY_FILES = 50;
