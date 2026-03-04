"use client";

import { useMemo } from "react";
import { Bug, Lightbulb, AlertTriangle, Zap } from "lucide-react";

interface TimelineTag {
  id: string;
  tagType: "BUG" | "IDEA" | "PAIN_POINT" | "INSIGHT";
  timestamp: number;
  user?: { id: string; name: string | null };
  createdAt: string;
}

interface TimelineNote {
  id: string;
  text: string;
  timestamp: number;
  user?: { id: string; name: string | null };
  createdAt: string;
}

interface SessionTimelineProps {
  tags: TimelineTag[];
  notes: TimelineNote[];
  duration: number; // Total session duration in seconds
  onSeek?: (timestamp: number) => void;
}

const TAG_STYLES: Record<
  string,
  { icon: typeof Bug; color: string; bg: string; label: string }
> = {
  BUG: { icon: Bug, color: "text-red-400", bg: "bg-red-500", label: "Bug" },
  PAIN_POINT: {
    icon: AlertTriangle,
    color: "text-orange-400",
    bg: "bg-orange-500",
    label: "Pain Point",
  },
  IDEA: {
    icon: Lightbulb,
    color: "text-amber-400",
    bg: "bg-amber-500",
    label: "Idea",
  },
  INSIGHT: {
    icon: Zap,
    color: "text-purple-400",
    bg: "bg-purple-500",
    label: "Insight",
  },
};

/**
 * A visual "heat-mapped" timeline showing where tags and notes were placed during the session.
 * Each marker is positioned proportionally along the timeline and is clickable to seek.
 */
export function SessionTimeline({
  tags,
  notes,
  duration,
  onSeek,
}: SessionTimelineProps) {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Merge and sort all events by timestamp
  const events = useMemo(() => {
    const allEvents = [
      ...tags.map((t) => ({
        type: "tag" as const,
        id: t.id,
        timestamp: t.timestamp,
        tagType: t.tagType,
        text: TAG_STYLES[t.tagType]?.label || t.tagType,
        user: t.user?.name || "Unknown",
      })),
      ...notes.map((n) => ({
        type: "note" as const,
        id: n.id,
        timestamp: n.timestamp,
        tagType: null,
        text: n.text,
        user: n.user?.name || "Unknown",
      })),
    ];
    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  }, [tags, notes]);

  const safeDuration = Math.max(duration, 1);

  return (
    <div className="space-y-4">
      {/* Visual Timeline Bar */}
      <div className="relative">
        <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
          <span>0:00</span>
          <span>{formatTime(safeDuration)}</span>
        </div>
        <div className="relative h-8 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {/* Heat segments based on tag density */}
          {tags.map((tag) => {
            const left = (tag.timestamp / safeDuration) * 100;
            const style = TAG_STYLES[tag.tagType];
            return (
              <button
                key={tag.id}
                className={`absolute top-0 h-full w-1.5 ${style?.bg || "bg-slate-500"} cursor-pointer opacity-60 transition-opacity hover:opacity-100`}
                style={{ left: `${Math.min(left, 99)}%` }}
                title={`${style?.label || tag.tagType} at ${formatTime(tag.timestamp)}`}
                onClick={() => onSeek?.(tag.timestamp)}
              />
            );
          })}
          {/* Note markers (smaller) */}
          {notes.map((note) => {
            const left = (note.timestamp / safeDuration) * 100;
            return (
              <button
                key={note.id}
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 cursor-pointer rounded-full border-2 border-white bg-blue-500 opacity-60 transition-opacity hover:opacity-100 dark:border-slate-900"
                style={{ left: `${Math.min(left, 99)}%` }}
                title={`Note at ${formatTime(note.timestamp)}: ${note.text.slice(0, 50)}`}
                onClick={() => onSeek?.(note.timestamp)}
              />
            );
          })}
        </div>
      </div>

      {/* Event List */}
      <div className="space-y-2">
        {events.map((event) => {
          if (event.type === "tag") {
            const style = TAG_STYLES[event.tagType!];
            const Icon = style?.icon || Zap;
            return (
              <button
                key={event.id}
                onClick={() => onSeek?.(event.timestamp)}
                className="hover:bg-accent flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors"
              >
                <span className="text-muted-foreground w-12 shrink-0 font-mono text-xs">
                  {formatTime(event.timestamp)}
                </span>
                <div className={`flex items-center gap-1.5 ${style?.color}`}>
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{event.text}</span>
                </div>
                <span className="text-muted-foreground ml-auto text-xs">
                  {event.user}
                </span>
              </button>
            );
          }
          return (
            <button
              key={event.id}
              onClick={() => onSeek?.(event.timestamp)}
              className="hover:bg-accent flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors"
            >
              <span className="text-muted-foreground w-12 shrink-0 pt-0.5 font-mono text-xs">
                {formatTime(event.timestamp)}
              </span>
              <p className="flex-1 text-sm">{event.text}</p>
              <span className="text-muted-foreground shrink-0 text-xs">
                {event.user}
              </span>
            </button>
          );
        })}
        {events.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No tags or notes were captured during this session.
          </p>
        )}
      </div>
    </div>
  );
}
