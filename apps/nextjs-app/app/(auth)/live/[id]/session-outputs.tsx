"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Loader2, User, Users, Zap, StickyNote, Video } from "lucide-react";
import {
  TAG_STYLES,
  formatTimestamp,
} from "@/apps/nextjs-app/components/live-session/constants";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionTag {
  id: string;
  tagType: "BUG" | "IDEA" | "PAIN_POINT" | "INSIGHT";
  timestamp: number;
  user?: { id: string; name: string | null };
  createdAt: string;
}

interface SessionNote {
  id: string;
  text: string;
  timestamp: number;
  user?: { id: string; name: string | null };
  createdAt: string;
}

export interface SessionOutputsSession {
  id: string;
  status: string;
  createdAt: string;
  recordingUrl?: string | null;
  transcriptText?: string | null;
  recordingStartedAt?: string | null;
  tags?: SessionTag[];
  notes?: SessionNote[];
  interviewer?: { id: string; name: string | null } | null;
}

// ─── Transcript parsing ─────────────────────────────────────────────────────

interface TranscriptEntry {
  speaker: string;
  text: string;
  startTime: number;
}

function parseTranscript(
  transcriptText: string | null | undefined,
): TranscriptEntry[] {
  if (!transcriptText) return [];
  const lines = transcriptText.split("\n").filter(Boolean);
  const entries: TranscriptEntry[] = [];
  for (const line of lines) {
    // Try "[MM:SS] Speaker: Text" or "[HH:MM:SS] Speaker: Text"
    const withSpeaker = line.match(
      /^\[(?:(\d+):)?(\d+):(\d+)\]\s*([^:]+):\s*(.+)$/,
    );
    if (withSpeaker) {
      const h = withSpeaker[1] ? parseInt(withSpeaker[1]) : 0;
      const m = parseInt(withSpeaker[2]);
      const s = parseInt(withSpeaker[3]);
      entries.push({
        speaker: withSpeaker[4].trim(),
        text: withSpeaker[5].trim(),
        startTime: h * 3600 + m * 60 + s,
      });
      continue;
    }
    // Try "[MM:SS] Text" or "[HH:MM:SS] Text" (no speaker)
    const noSpeaker = line.match(/^\[(?:(\d+):)?(\d+):(\d+)\]\s*(.+)$/);
    if (noSpeaker) {
      const h = noSpeaker[1] ? parseInt(noSpeaker[1]) : 0;
      const m = parseInt(noSpeaker[2]);
      const s = parseInt(noSpeaker[3]);
      entries.push({
        speaker: "",
        text: noSpeaker[4].trim(),
        startTime: h * 3600 + m * 60 + s,
      });
      continue;
    }
    // Fallback: plain text
    entries.push({ speaker: "", text: line.trim(), startTime: 0 });
  }
  return entries;
}

// ─── Timeline item types ────────────────────────────────────────────────────

type TimelineItem =
  | {
      kind: "transcript";
      entry: TranscriptEntry;
      id: string;
      timestamp: number;
    }
  | { kind: "tag"; tag: SessionTag; id: string; timestamp: number }
  | { kind: "note"; note: SessionNote; id: string; timestamp: number };

// ─── Component ──────────────────────────────────────────────────────────────

export function SessionOutputs({
  session,
}: {
  session: SessionOutputsSession;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoHeight, setVideoHeight] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [autoScroll, setAutoScroll] = useState(true);

  // Track video playback time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  // Sync transcript height to the video container height
  useEffect(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setVideoHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tags = session.tags || [];
  const notes = session.notes || [];
  const transcriptEntries = useMemo(
    () => parseTranscript(session.transcriptText),
    [session.transcriptText],
  );

  const seekTo = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    video.play().catch(() => {});
  };

  const createdAtMs = new Date(session.createdAt).getTime();
  const recordingStartedAtMs = session.recordingStartedAt
    ? new Date(session.recordingStartedAt).getTime()
    : null;

  const eventOffset = recordingStartedAtMs
    ? (recordingStartedAtMs - createdAtMs) / 1000
    : 0;

  const items = useMemo<TimelineItem[]>(
    () =>
      [
        ...transcriptEntries.map((entry, i) => ({
          kind: "transcript" as const,
          entry,
          id: `t-${i}`,
          timestamp: entry.startTime,
        })),
        ...tags.map((t) => ({
          kind: "tag" as const,
          tag: t,
          id: `tag-${t.id}`,
          timestamp: t.timestamp - eventOffset,
        })),
        ...notes.map((n) => ({
          kind: "note" as const,
          note: n,
          id: `note-${n.id}`,
          timestamp: n.timestamp - eventOffset,
        })),
      ].sort((a, b) => a.timestamp - b.timestamp),
    [transcriptEntries, tags, notes, eventOffset],
  );

  const hasTranscript = transcriptEntries.length > 0;
  const hasEvents = tags.length > 0 || notes.length > 0;

  const activeItemIndex = useMemo(
    () =>
      items.reduce((best, item, i) => {
        if (item.timestamp <= currentTime) return i;
        return best;
      }, -1),
    [items, currentTime],
  );

  // Auto-scroll transcript to the active item
  useEffect(() => {
    if (!autoScroll || activeItemIndex < 0) return;
    const container = transcriptRef.current;
    if (!container) return;
    const activeEl = container.children[activeItemIndex] as
      | HTMLElement
      | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeItemIndex, autoScroll]);

  const normalizedTags = useMemo(
    () => tags.map((t) => ({ ...t, timestamp: t.timestamp - eventOffset })),
    [tags, eventOffset],
  );
  const normalizedNotes = useMemo(
    () => notes.map((n) => ({ ...n, timestamp: n.timestamp - eventOffset })),
    [notes, eventOffset],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Video recording */}
        {session.recordingUrl ? (
          <div
            ref={videoContainerRef}
            className="group/video relative shrink-0 self-start overflow-hidden rounded-lg border bg-black lg:w-1/2"
          >
            <video
              ref={videoRef}
              src={session.recordingUrl}
              controls
              className="aspect-video w-full"
              onLoadedMetadata={() => {
                if (videoRef.current)
                  setVideoDuration(videoRef.current.duration);
              }}
            />
            {/* Marker overlay */}
            {videoDuration > 0 &&
              (normalizedTags.length > 0 || normalizedNotes.length > 0) && (
                <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-4 px-3 opacity-0 transition-opacity duration-300 group-hover/video:opacity-100">
                  {normalizedTags.map((t) => {
                    const pct = Math.min(
                      (t.timestamp / videoDuration) * 100,
                      100,
                    );
                    const style = TAG_STYLES[t.tagType];
                    const Icon = style?.icon || Zap;
                    return (
                      <span
                        key={`marker-tag-${t.id}`}
                        className="absolute top-0 -translate-x-1/2"
                        style={{ left: `${pct}%` }}
                        title={`${style?.label || t.tagType} at ${formatTimestamp(t.timestamp)}`}
                      >
                        <Icon
                          className={`h-4 w-4 ${style?.color} drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]`}
                        />
                      </span>
                    );
                  })}
                  {normalizedNotes.map((n) => {
                    const pct = Math.min(
                      (n.timestamp / videoDuration) * 100,
                      100,
                    );
                    return (
                      <span
                        key={`marker-note-${n.id}`}
                        className="absolute top-0 -translate-x-1/2"
                        style={{ left: `${pct}%` }}
                        title={`Note at ${formatTimestamp(n.timestamp)}: ${n.text.slice(0, 60)}`}
                      >
                        <StickyNote className="h-4 w-4 text-blue-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                      </span>
                    );
                  })}
                </div>
              )}
          </div>
        ) : (
          <div className="text-muted-foreground flex shrink-0 items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm lg:w-1/2">
            <Video className="h-4 w-4" />
            {session.status === "PROCESSING"
              ? "Recording is being processed…"
              : session.status === "ENDED"
                ? "Recording will be available once processing completes."
                : "No recording available."}
          </div>
        )}

        {/* Unified transcript + tags/notes timeline */}
        {session.status === "PROCESSING" || session.status === "ENDED" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-12">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <p className="text-muted-foreground text-sm">
              Processing recording…
            </p>
          </div>
        ) : hasTranscript || hasEvents ? (
          <div
            className="flex min-h-0 min-w-0 flex-col lg:flex-1"
            style={videoHeight > 0 ? { maxHeight: videoHeight } : { maxHeight: 500 }}
          >
            <div
              ref={transcriptRef}
              className="max-h-[500px] min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto rounded-lg border bg-white lg:max-h-none dark:divide-zinc-800/50 dark:bg-zinc-900/50"
              onMouseEnter={() => setAutoScroll(false)}
              onMouseLeave={() => setAutoScroll(true)}
            >
              {items.map((item, idx) => {
                const isActive = idx === activeItemIndex;
                if (item.kind === "tag") {
                  const style = TAG_STYLES[item.tag.tagType];
                  const Icon = style?.icon || Zap;
                  return (
                    <div
                      key={item.id}
                      className={`flex cursor-pointer gap-3 px-4 py-2 transition-colors ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}
                      onClick={() => seekTo(item.timestamp)}
                    >
                      <span className="text-muted-foreground w-10 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums">
                        {formatTimestamp(item.timestamp)}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] leading-none font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          <User className="h-2.5 w-2.5" />
                          {item.tag.user?.name || "Unknown"}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-none font-medium ${style?.color}`}
                          style={{
                            backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)`,
                          }}
                        >
                          <Icon className="h-3 w-3" />
                          {style?.label || item.tag.tagType}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (item.kind === "note") {
                  return (
                    <div
                      key={item.id}
                      className={`flex cursor-pointer gap-3 px-4 py-2 transition-colors ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}
                      onClick={() => seekTo(item.timestamp)}
                    >
                      <span className="text-muted-foreground w-10 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums">
                        {formatTimestamp(item.timestamp)}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] leading-none font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          <User className="h-2.5 w-2.5" />
                          {item.note.user?.name || "Unknown"}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] leading-none font-medium text-blue-500 dark:bg-blue-950/50">
                          <StickyNote className="h-3 w-3" />
                          Note
                        </span>
                        <span className="text-sm leading-snug text-zinc-700 dark:text-zinc-300">
                          {item.note.text}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Transcript entry
                return (
                  <div
                    key={item.id}
                    className={`flex cursor-pointer gap-3 px-4 py-2 transition-colors ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}
                    onClick={() => seekTo(item.entry.startTime)}
                  >
                    <span className="text-muted-foreground w-10 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums">
                      {formatTimestamp(item.entry.startTime)}
                    </span>
                    <div className="flex min-w-0 flex-1 items-start gap-1.5">
                      {item.entry.speaker &&
                        (() => {
                          const displayName =
                            item.entry.speaker === "Interviewer" &&
                            session.interviewer?.name
                              ? session.interviewer.name
                              : item.entry.speaker;
                          const SpeakerIcon =
                            item.entry.speaker === "Interviewer" ? User : Users;
                          return (
                            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] leading-none font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              <SpeakerIcon className="h-2.5 w-2.5" />
                              {displayName}
                            </span>
                          );
                        })()}
                      <span className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                        {item.entry.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground py-2 text-sm">
            No transcript, tags, or notes available for this session.
          </p>
        )}
      </div>
    </div>
  );
}
