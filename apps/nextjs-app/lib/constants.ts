// Shared enum for menu surfaces.
// Kept in a non-client module so server and client components can import it safely.
export enum MenuSurface {
  EVALUATION = "EVALUATION",
  WALKTHROUGH = "WALKTHROUGH",
  PERSONA = "PERSONA",
}

export const PERSONAL_TEAM_MAX_STUDY_FILES = 10;
export const SHARED_TEAM_MAX_STUDY_FILES = 50;
