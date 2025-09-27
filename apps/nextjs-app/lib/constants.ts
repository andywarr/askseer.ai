// Shared enum for menu surfaces.
// Kept in a non-client module so server and client components can import it safely.
export enum MenuSurface {
  EVALUATION = "EVALUATION",
  WALKTHROUGH = "WALKTHROUGH",
  PERSONA = "PERSONA",
}

export const PERSONAL_STUDY_FILE_LIMIT = 10;
export const TEAM_STUDY_FILE_LIMIT = 50;
