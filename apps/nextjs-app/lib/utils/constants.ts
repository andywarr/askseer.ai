// Shared enum for menu surfaces.
// Kept in a non-client module so server and client components can import it safely.
export enum MenuSurface {
  EVALUATION = "EVALUATION",
  WALKTHROUGH = "WALKTHROUGH",
  PERSONA = "PERSONA",
  LIVE_SESSION = "LIVE_SESSION",
  ANALYSIS = "ANALYSIS",
}

export const TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES = 10;
export const TEAM_WITH_COMPANY_MAX_STUDY_FILES = 99;

// Warning threshold: flows with more than this many screens will show a warning
// and trigger an email alert to the team
export const LONG_FLOW_WARNING_THRESHOLD = 25;
