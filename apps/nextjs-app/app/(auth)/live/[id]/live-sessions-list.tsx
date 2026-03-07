"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import {
  Plus,
  User,
  Users,
  Eye,
  FileText,
  Copy,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Bug,
  AlertTriangle,
  Lightbulb,
  Zap,
  StickyNote,
  Video,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import type { ActionResult } from "@/apps/nextjs-app/lib/actions/shared";
import {
  runLiveStudyAnalysis,
  createLiveSessionRecords,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";

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

interface LiveSession {
  id: string;
  name: string | null;
  status: string;
  createdAt: string;
  interviewerLink: string;
  customerLink: string;
  observerLink: string;
  recordingUrl?: string | null;
  transcriptText?: string | null;
  startedAt?: string | null;
  recordingStartedAt?: string | null;
  endedAt?: string | null;
  tags?: SessionTag[];
  notes?: SessionNote[];
  interviewer?: { id: string; name: string | null } | null;
}

const TAG_STYLES: Record<
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

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface LiveSessionsListProps {
  studyId: string;
  initialSessions: LiveSession[];
  hasAnalysis: boolean;
  isCreator: boolean;
  renameLiveSession: (
    liveSessionId: string,
    name: string,
  ) => Promise<ActionResult>;
  deleteLiveSessionAction: (liveSessionId: string) => Promise<ActionResult>;
}

export function LiveSessionsList({
  studyId,
  initialSessions,
  hasAnalysis,
  isCreator,
  renameLiveSession,
  deleteLiveSessionAction,
}: LiveSessionsListProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisQueued, setAnalysisQueued] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Re-sync local state when server data changes (e.g. navigating back after a session ends)
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    if (editingId && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [editingId]);

  const visibleSessions = sessions.filter((s) => !removedIds.has(s.id));
  const completedCount = visibleSessions.filter(
    (s) =>
      s.status === "ENDED" ||
      s.status === "PROCESSING" ||
      s.status === "COMPLETED",
  ).length;
  const allComplete =
    visibleSessions.length > 0 && completedCount === visibleSessions.length;

  const handleAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const result = await runLiveStudyAnalysis(studyId);
      if (result.success) {
        setAnalysisQueued(true);
        toast.success("Analysis started");
      } else {
        toast.error(result.error || "Failed to start analysis");
      }
    } catch {
      toast.error("Failed to start analysis");
    } finally {
      setAnalyzing(false);
    }
  }, [studyId]);

  const handleCreateSession = useCallback(async () => {
    setCreatingSession(true);
    try {
      const newSessions = await createLiveSessionRecords(studyId, 1);
      if (newSessions?.length) {
        router.refresh();
        toast.success("Session created");
      }
    } catch {
      toast.error("Failed to create session");
    } finally {
      setCreatingSession(false);
    }
  }, [studyId, router]);

  const handleRename = useCallback(
    async (sessionId: string, newName: string) => {
      const trimmed = newName.trim();
      const session = sessions.find((s) => s.id === sessionId);
      if (!trimmed || trimmed === (session?.name || "")) {
        setEditingId(null);
        return;
      }

      setSavingId(sessionId);
      const result = await renameLiveSession(sessionId, trimmed);
      setSavingId(null);
      setEditingId(null);

      if (result.success) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, name: trimmed } : s)),
        );
      } else {
        toast.error("Failed to rename session");
      }
    },
    [sessions, renameLiveSession],
  );

  const handleDelete = useCallback(
    async (sessionId: string) => {
      setDeletingId(sessionId);
      const result = await deleteLiveSessionAction(sessionId);
      setDeletingId(null);
      setConfirmDeleteId(null);

      if (result.success) {
        setRemovedIds((prev) => new Set([...prev, sessionId]));
        toast.success("Session deleted");
      } else {
        toast.error("Failed to delete session");
      }
    },
    [deleteLiveSessionAction],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Sessions
        </h3>
        <div className="flex items-center gap-3">
          <span className="flex items-baseline gap-1">
            <span className="text-4xl text-zinc-500">
              {visibleSessions.length}
            </span>
            <span className="text-zinc-500">
              {visibleSessions.length === 1 ? "session" : "sessions"}
            </span>
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-4xl text-zinc-500">{completedCount}</span>
            <span className="text-zinc-500">complete</span>
          </span>
          {hasAnalysis || analysisQueued ? (
            <Button
              size="sm"
              variant="secondary"
              asChild={hasAnalysis}
              disabled={!hasAnalysis}
            >
              {hasAnalysis ? (
                <Link href={`/analysis/${studyId}`}>View Analysis</Link>
              ) : (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analysis
                </>
              )}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={!isCreator ? 0 : undefined}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!isCreator || !allComplete || analyzing}
                    onClick={handleAnalysis}
                  >
                    {analyzing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Analysis
                  </Button>
                </span>
              </TooltipTrigger>
              {!isCreator && (
                <TooltipContent>
                  Only the study creator can run analysis
                </TooltipContent>
              )}
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={!isCreator ? 0 : undefined}>
                <Button
                  size="sm"
                  disabled={!isCreator || creatingSession}
                  onClick={handleCreateSession}
                >
                  {creatingSession ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  New Session
                </Button>
              </span>
            </TooltipTrigger>
            {!isCreator && (
              <TooltipContent>
                Only the study creator can create sessions
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {visibleSessions.length > 0 ? (
        <Accordion
          type="multiple"
          defaultValue={visibleSessions.map((s) => s.id)}
        >
          {visibleSessions.map((session, index) => (
            <AccordionItem key={session.id} value={session.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="group/trigger flex w-full items-center justify-between gap-4">
                  {editingId === session.id ? (
                    <div
                      className="flex min-w-0 flex-1 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingId(null);
                          }
                          if (e.key === "Enter") {
                            handleRename(session.id, editingValue);
                          }
                        }}
                        disabled={savingId === session.id}
                        className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium focus:border-zinc-400 focus:outline-none"
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md"
                        onClick={() => handleRename(session.id, editingValue)}
                      >
                        {savingId === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex cursor-text items-center gap-1 max-md:cursor-default"
                      onClick={(e) => {
                        if (e.detail >= 2) {
                          e.stopPropagation();
                          setEditingValue(
                            session.name || `Session ${index + 1}`,
                          );
                          setEditingId(session.id);
                        }
                      }}
                    >
                      <span className="text-left text-base font-bold">
                        {session.name || `Session ${index + 1}`}
                      </span>
                      <div
                        role="button"
                        tabIndex={0}
                        className="hover:bg-accent hover:text-accent-foreground inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-0 transition-opacity group-hover/trigger:opacity-100 max-md:pointer-events-none max-md:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingValue(
                            session.name || `Session ${index + 1}`,
                          );
                          setEditingId(session.id);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400 opacity-0 transition-opacity group-hover/trigger:opacity-100 hover:bg-red-50 hover:text-red-500 max-md:pointer-events-none max-md:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(session.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  )}
                  {/* Status badge on the right */}
                  <div className="mr-2 ml-auto shrink-0">
                    {session.status === "LIVE" && (
                      <Badge
                        variant="default"
                        className="bg-emerald-600 text-xs hover:bg-emerald-600"
                      >
                        <span className="relative mr-1.5 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        Live
                      </Badge>
                    )}
                    {session.status === "ENDED" && (
                      <Badge variant="secondary" className="text-xs">
                        Ended
                      </Badge>
                    )}
                    {session.status === "PROCESSING" && (
                      <Badge variant="secondary" className="text-xs">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Processing
                      </Badge>
                    )}
                    {session.status === "COMPLETED" && (
                      <Badge variant="default" className="text-xs">
                        Completed
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4 pl-1">
                  {session.status === "SCHEDULED" ||
                  session.status === "LIVE" ? (
                    <>
                      {/* Role links — only shown before session ends */}
                      <div className="grid gap-3 sm:grid-cols-3">
                        {isCreator ? (
                          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                            <Link
                              href={`/session/${session.interviewerLink}`}
                              className="flex flex-1 items-center gap-2"
                              target="_blank"
                            >
                              <User className="h-4 w-4" />
                              <span className="font-medium">Interviewer</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/session/${session.interviewerLink}`,
                                );
                                toast.success("Interviewer link copied");
                              }}
                              className="ml-auto rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            >
                              <Copy className="text-muted-foreground h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm opacity-50"
                            title="Only the study creator can join as interviewer"
                          >
                            <User className="h-4 w-4" />
                            <span className="font-medium">Interviewer</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          <Link
                            href={`/session/${session.observerLink}`}
                            className="flex flex-1 items-center gap-2"
                            target="_blank"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="font-medium">Observer</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/session/${session.observerLink}`,
                              );
                              toast.success("Observer link copied");
                            }}
                            className="ml-auto rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          >
                            <Copy className="text-muted-foreground h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          <Link
                            href={`/session/${session.customerLink}`}
                            className="flex flex-1 items-center gap-2"
                            target="_blank"
                          >
                            <Users className="h-4 w-4" />
                            <span className="font-medium">Participant</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/session/${session.customerLink}`,
                              );
                              toast.success("Participant link copied");
                            }}
                            className="ml-auto rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          >
                            <Copy className="text-muted-foreground h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {session.status === "SCHEDULED" && (
                        <p className="py-2 text-zinc-500">
                          There is no data for this session yet.
                        </p>
                      )}
                    </>
                  ) : (
                    <SessionOutputs session={session} />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed text-center">
          <p className="text-muted-foreground text-sm">
            No sessions created yet.
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={!isCreator ? 0 : undefined}>
                <Button
                  variant="link"
                  className="mt-2"
                  disabled={!isCreator || creatingSession}
                  onClick={handleCreateSession}
                >
                  {creatingSession ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create your first session
                </Button>
              </span>
            </TooltipTrigger>
            {!isCreator && (
              <TooltipContent>
                Only the study creator can create sessions
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      )}

      {/* Delete Session Confirmation Dialog */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This will
              permanently remove the session and all its data. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteId) {
                  handleDelete(confirmDeleteId);
                }
              }}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Parse transcript text into entries ─── */

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

/* ── Unified timeline item types ─── */

type TimelineItem =
  | { kind: "transcript"; entry: TranscriptEntry; id: string }
  | { kind: "tag"; tag: SessionTag; id: string; timestamp: number }
  | { kind: "note"; note: SessionNote; id: string; timestamp: number };

/* ── Inline session outputs (video + transcript with interleaved tags/notes) ─── */

function SessionOutputs({ session }: { session: LiveSession }) {
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
  const transcriptEntries = parseTranscript(session.transcriptText);

  const seekTo = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    video.play().catch(() => {});
  };

  // Tag/note timestamps are stored as (Date.now() - sessionStartTime) / 1000
  // where sessionStartTime in live-session-room.tsx uses session.startedAt if
  // available, falling back to session.createdAt. Because the session prop is
  // the initial server-rendered data (startedAt is null when status=SCHEDULED),
  // sessionStartTime is effectively createdAt for the entire session.
  // Recording starts when the interviewer clicks "Start Session", saved as
  // recordingStartedAt. So: eventOffset = (recordingStartedAt - createdAt) / 1000
  const createdAtMs = new Date(session.createdAt).getTime();
  const recordingStartedAtMs = session.recordingStartedAt
    ? new Date(session.recordingStartedAt).getTime()
    : null;

  // Compute the offset between tag/note timestamps and the video timeline.
  // Tags are relative to createdAt; video starts at recordingStartedAt.
  const eventOffset = recordingStartedAtMs
    ? (recordingStartedAtMs - createdAtMs) / 1000
    : 0;

  // Build a unified timeline: transcript entries + tags + notes, sorted by timestamp
  const items: TimelineItem[] = [
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
  ].sort((a, b) => a.timestamp - b.timestamp);

  const hasTranscript = transcriptEntries.length > 0;
  const hasEvents = tags.length > 0 || notes.length > 0;

  // Find the active timeline item index based on current video time
  const activeItemIndex = items.reduce((best, item, i) => {
    if (item.timestamp <= currentTime) return i;
    return best;
  }, -1);

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

  // Normalized tag/note markers for the video timeline bar
  const normalizedTags = tags.map((t) => ({
    ...t,
    timestamp: t.timestamp - eventOffset,
  }));
  const normalizedNotes = notes.map((n) => ({
    ...n,
    timestamp: n.timestamp - eventOffset,
  }));

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
            {/* Marker overlay — pointer-events-none so it never steals hover from the video */}
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
        {hasTranscript || hasEvents ? (
          <div
            className="flex min-h-0 min-w-0 flex-col lg:flex-1"
            style={videoHeight > 0 ? { maxHeight: videoHeight } : undefined}
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
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
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
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] leading-none font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
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
