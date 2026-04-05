import { Bug, AlertTriangle, Lightbulb, Zap } from "lucide-react";

// ─── Shared session data type ───────────────────────────────────────────────

/** Minimal shape of a live session object passed into room view components. */
export interface LiveSessionData {
  id: string;
  name: string | null;
  status: "SCHEDULED" | "LIVE" | "ENDED" | "PROCESSING" | "COMPLETED";
  studyId: string;
  startedAt: string | null;
  createdAt: string;
  study: {
    name: string | null;
    teamId: string;
  };
  /** Extracted text from the uploaded discussion guide file (parsed PDF/doc). */
  discussionGuideText: string | null;
}

// ─── Shared tag type ────────────────────────────────────────────────────────

export type ReactionTagType = "BUG" | "IDEA" | "PAIN_POINT" | "INSIGHT";

// ─── TAG_CONFIG — used in live-session room toolbars (Interviewer & Observer) ─

export const TAG_CONFIG = [
  {
    type: "BUG" as ReactionTagType,
    label: "Bug",
    icon: Bug,
    color: "!text-red-500",
    bg: "hover:bg-red-500/20",
  },
  {
    type: "PAIN_POINT" as ReactionTagType,
    label: "Pain",
    icon: AlertTriangle,
    color: "!text-orange-500",
    bg: "hover:bg-orange-500/20",
  },
  {
    type: "IDEA" as ReactionTagType,
    label: "Idea",
    icon: Lightbulb,
    color: "!text-amber-500",
    bg: "hover:bg-amber-500/20",
  },
  {
    type: "INSIGHT" as ReactionTagType,
    label: "Insight",
    icon: Zap,
    color: "!text-purple-500",
    bg: "hover:bg-purple-500/20",
  },
];

// ─── TAG_STYLES — used in session outputs timeline ──────────────────────────

export const TAG_STYLES: Record<
  string,
  { icon: typeof Bug; color: string; label: string }
> = {
  BUG: { icon: Bug, color: "text-red-500", label: "Bug" },
  PAIN_POINT: {
    icon: AlertTriangle,
    color: "text-orange-500",
    label: "Pain Point",
  },
  IDEA: { icon: Lightbulb, color: "text-amber-500", label: "Idea" },
  INSIGHT: { icon: Zap, color: "text-purple-500", label: "Insight" },
};

// ─── Shared helper ──────────────────────────────────────────────────────────

export function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
