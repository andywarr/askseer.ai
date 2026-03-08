"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
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
  BarChart3,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/apps/nextjs-app/components/ui/card";
import { SessionOutputs } from "./session-outputs";
import type { ActionResult } from "@/apps/nextjs-app/lib/actions/shared";
import {
  runLiveStudyAnalysis,
  createLiveSessionRecords,
  pollLiveStudySessions,
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

  // Re-sync local state when server data changes (e.g. navigating back after a session ends)
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  // Auto-refresh only session data when any session is in a transient state.
  // We poll via a server action instead of router.refresh() so that the
  // parent server component does not re-run (which would regenerate presigned
  // avatar URLs and cause images to flicker).
  const hasTransientSession = sessions.some(
    (s) =>
      s.status === "SCHEDULED" ||
      s.status === "LIVE" ||
      s.status === "ENDED" ||
      s.status === "PROCESSING",
  );
  useEffect(() => {
    if (!hasTransientSession) return;
    const id = setInterval(async () => {
      try {
        const updated = await pollLiveStudySessions(studyId);
        if (updated) setSessions(updated);
      } catch {
        // Silently ignore polling errors — will retry on next interval
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [hasTransientSession, studyId]);

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
        const updated = await pollLiveStudySessions(studyId);
        if (updated) setSessions(updated);
        toast.success("Session created");
      }
    } catch {
      toast.error("Failed to create session");
    } finally {
      setCreatingSession(false);
    }
  }, [studyId]);

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
      {/* Analysis banner — shown when all sessions are done but analysis hasn't been run */}
      {allComplete && !hasAnalysis && !analysisQueued && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-gradient-to-r from-violet-50 via-pink-50 to-white px-4 py-3 dark:border-zinc-700 dark:from-violet-950/30 dark:via-pink-950/20 dark:to-zinc-900">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            All sessions are complete. Run an analysis to generate insights
            from your sessions.
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={!isCreator ? 0 : undefined}>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!isCreator || analyzing}
                  onClick={handleAnalysis}
                >
                  {analyzing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart3 className="mr-2 h-4 w-4" />
                  )}
                  Run Analysis
                </Button>
              </span>
            </TooltipTrigger>
            {!isCreator && (
              <TooltipContent>
                Only the study creator can run analysis
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      )}

      {analysisQueued && !hasAnalysis && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-zinc-200 bg-gradient-to-r from-violet-50 via-pink-50 to-white px-4 py-3 dark:border-zinc-700 dark:from-violet-950/30 dark:via-pink-950/20 dark:to-zinc-900">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Analysis is running. This may take a few minutes.
          </p>
        </div>
      )}

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
          <span className="hidden items-baseline gap-1 sm:flex">
            <span className="text-4xl text-zinc-500">{completedCount}</span>
            <span className="text-zinc-500">complete</span>
          </span>
          {hasAnalysis ? (
            <Button size="sm" asChild>
              <Link href={`/analysis/${studyId}`}>
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">View Analysis</span>
              </Link>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={!isCreator ? 0 : undefined}>
                  <Button
                    size="sm"
                    disabled={!isCreator || creatingSession}
                    onClick={handleCreateSession}
                  >
                    {creatingSession ? (
                      <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">New Session</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {!isCreator && (
                <TooltipContent>
                  Only the study creator can create sessions
                </TooltipContent>
              )}
            </Tooltip>
          )}
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
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">
                            Session Links
                          </CardTitle>
                          <CardDescription>
                            Copy and share these links with your participants
                            and observers, or click to join the session
                            directly.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {isCreator ? (
                              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                <Link
                                  href={`/session/${session.interviewerLink}`}
                                  className="flex flex-1 items-center gap-2"
                                  target="_blank"
                                >
                                  <User className="h-4 w-4" />
                                  <span className="font-medium">
                                    Interviewer
                                  </span>
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
                        </CardContent>
                      </Card>
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
