"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { InlineActionButton } from "@/apps/nextjs-app/components/ui/inline-action-button";

import {
  Plus,
  Mic,
  Eye,
  Copy,
  Loader2,
  CheckCircle2,
  Clock,
  Trash2,
  AlertTriangle,
  FileText,
  MessageSquare,
  BarChart3,
  Pencil,
  Check,
  X,
  User,
  XCircle,
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
import {
  createInterviewSession,
  getInterviewData,
  deleteInterviewSessionAction,
  renameInterviewSession,
} from "@/apps/nextjs-app/lib/actions/interview-actions";
import { runInterviewAnalysis } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { useTeamBalance } from "@/apps/nextjs-app/components/layout/team-balance-context";

interface InterviewMessage {
  id: string;
  speaker: "AI" | "PARTICIPANT";
  text: string;
  createdAt: string;
}

interface InterviewSession {
  id: string;
  name?: string | null;
  status: string;
  participantLink: string;
  observerLink: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  recordingKey?: string | null;
  recordingUrl?: string | null;
  messages?: InterviewMessage[];
}

interface InterviewSessionsListProps {
  studyId: string;
  interviewId: string | null;
  initialSessions: InterviewSession[];
  hasAnalysis: boolean;
  isCreator: boolean;
  balanceCents: number;
  sessionCostCents: number;
  canPurchaseCredits?: boolean;
  endDate?: string | null;
}

export function InterviewSessionsList({
  studyId,
  interviewId,
  initialSessions,
  hasAnalysis,
  isCreator,
  balanceCents,
  sessionCostCents,
  canPurchaseCredits,
  endDate,
}: InterviewSessionsListProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [balance, setBalance] = useState(balanceCents);
  const { adjustBalance } = useTeamBalance();
  const [creatingSession, setCreatingSession] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisQueued, setAnalysisQueued] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus title input when editing
  useEffect(() => {
    if (editingId && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [editingId]);

  // Sync with server-rendered initial data
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  // Auto-refresh session data when any session is in a transient state
  const hasTransientSession = sessions.some(
    (s) =>
      s.status === "SCHEDULED" || s.status === "LIVE" || s.status === "PAUSED",
  );
  useEffect(() => {
    if (!hasTransientSession) return;
    const id = setInterval(async () => {
      try {
        const refreshed = await getInterviewData(studyId);
        if (refreshed.success && refreshed.data?.sessions) {
          setSessions(refreshed.data.sessions);
        }
      } catch {
        // Silently ignore polling errors — will retry on next interval
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [hasTransientSession, studyId]);

  const visibleSessions = sessions.filter((s) => !removedIds.has(s.id));
  const completedCount = visibleSessions.filter(
    (s) => s.status === "COMPLETED",
  ).length;
  const liveCount = visibleSessions.filter((s) => s.status === "LIVE").length;
  const allComplete =
    visibleSessions.length > 0 && completedCount === visibleSessions.length;

  const handleAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const result = await runInterviewAnalysis(studyId);
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

  const copyLink = useCallback(async (link: string, label: string) => {
    const url = `${window.location.origin}/session/interview/${link}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(link);
    toast.success(`${label} link copied!`);
    setTimeout(() => setCopiedLink(null), 2000);
  }, []);

  const handleCreateSession = useCallback(async () => {
    if (!interviewId) {
      toast.error(
        "Interview not ready yet. Please wait for processing to complete.",
      );
      return;
    }

    setCreatingSession(true);
    try {
      const result = await createInterviewSession(interviewId);
      if (result.success) {
        toast.success("Session created!");
        // Refresh interview data to get updated sessions
        const refreshed = await getInterviewData(studyId);
        if (refreshed.success && refreshed.data?.sessions) {
          setSessions(refreshed.data.sessions);
        }
        setBalance((prev) => prev - sessionCostCents);
        adjustBalance(-sessionCostCents);
      } else {
        toast.error(result.error || "Failed to create session");
      }
    } catch {
      toast.error("Failed to create session");
    } finally {
      setCreatingSession(false);
    }
  }, [interviewId, studyId]);

  const handleDelete = useCallback(
    async (sessionId: string) => {
      const wasScheduled =
        sessions.find((s) => s.id === sessionId)?.status === "SCHEDULED";
      setDeletingId(sessionId);
      const result = await deleteInterviewSessionAction(sessionId);
      setDeletingId(null);
      setConfirmDeleteId(null);

      if (result.success) {
        setRemovedIds((prev) => new Set([...prev, sessionId]));
        if (wasScheduled) {
          setBalance((prev) => prev + sessionCostCents);
          adjustBalance(sessionCostCents);
        }
        toast.success("Session deleted");
      } else {
        toast.error("Failed to delete session");
      }
    },
    [sessions, sessionCostCents],
  );

  const handleRename = useCallback(
    async (sessionId: string, newName: string) => {
      const trimmed = newName.trim();
      const session = sessions.find((s) => s.id === sessionId);
      if (!trimmed || trimmed === (session?.name || "")) {
        setEditingId(null);
        return;
      }

      setSavingId(sessionId);
      const result = await renameInterviewSession(sessionId, trimmed);
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
    [sessions],
  );

  const hasInsufficientFunds = balance < sessionCostCents;
  const isExpired = endDate ? new Date(endDate) < new Date() : false;

  return (
    <div>
      {/* Insufficient funds banner */}
      {hasInsufficientFunds && isCreator && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Insufficient funds to create new sessions. A session costs $
              {(sessionCostCents / 100).toFixed(2)} (balance: $
              {(balance / 100).toFixed(2)}).
            </p>
          </div>
          {canPurchaseCredits && (
            <Link
              href="/funds"
              className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
            >
              Manage Funds
            </Link>
          )}
        </div>
      )}
      {/* Analysis banner — shown when all sessions are done but analysis hasn't been run */}
      {allComplete && !hasAnalysis && !analysisQueued && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-gradient-to-r from-violet-50 via-pink-50 to-white px-4 py-3 dark:border-zinc-700 dark:from-violet-950/30 dark:via-pink-950/20 dark:to-zinc-900">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            All sessions are complete. Run an analysis to generate insights from
            your sessions.
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
      {/* End Date moved to metadata section on study page */}

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
          {completedCount > 0 && (
            <span className="hidden items-baseline gap-1 sm:flex">
              <span className="text-4xl text-zinc-500">{completedCount}</span>
              <span className="text-zinc-500">complete</span>
            </span>
          )}
          {liveCount > 0 && (
            <span className="hidden items-baseline gap-1 sm:flex">
              <span className="text-4xl text-green-500">{liveCount}</span>
              <span className="text-green-500">live</span>
            </span>
          )}
          {hasAnalysis && (
            <Button size="sm" asChild>
              <Link href={`/analysis/${studyId}`}>
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">View Analysis</span>
              </Link>
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={!isCreator ? 0 : undefined}>
                <Button
                  size="sm"
                  disabled={
                    !isCreator ||
                    creatingSession ||
                    !interviewId ||
                    hasInsufficientFunds ||
                    isExpired
                  }
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
            {isCreator && hasInsufficientFunds && !isExpired && (
              <TooltipContent>
                Insufficient funds to create a session
              </TooltipContent>
            )}
            {isCreator && isExpired && (
              <TooltipContent>
                This interview&apos;s end date has passed
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
                        className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium focus:border-zinc-400 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800"
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
                      <InlineActionButton
                        action="edit"
                        showOnHoverClass="group-hover/trigger:opacity-100"
                        className="max-md:pointer-events-none max-md:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingValue(
                            session.name || `Session ${index + 1}`,
                          );
                          setEditingId(session.id);
                        }}
                      />
                      {isCreator && (
                        <InlineActionButton
                          action="delete"
                          showOnHoverClass="group-hover/trigger:opacity-100"
                          className="max-md:pointer-events-none max-md:hidden"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(session.id);
                          }}
                        />
                      )}
                    </div>
                  )}
                  <div className="mr-2 ml-auto flex shrink-0 items-center gap-2">
                    {session.status === "SCHEDULED" && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        Scheduled
                      </Badge>
                    )}
                    {session.status === "LIVE" && (
                      <Badge
                        variant="default"
                        className="bg-green-600 text-xs hover:bg-green-600"
                      >
                        <span className="relative mr-1.5 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        Live
                      </Badge>
                    )}
                    {session.status === "COMPLETED" && (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Completed
                      </Badge>
                    )}
                    {session.status === "INCOMPLETE" && (
                      <Badge
                        variant="outline"
                        className="border-amber-600 text-xs text-amber-600 dark:border-amber-500 dark:text-amber-500"
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        Incomplete
                      </Badge>
                    )}
                    {session.status === "PAUSED" && (
                      <Badge
                        variant="outline"
                        className="border-purple-600 text-xs text-purple-600 dark:border-purple-400 dark:text-purple-400"
                      >
                        <Clock className="mr-1 h-3 w-3" />
                        Paused
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
                      {/* Session Links — only shown before session ends */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">
                            Session Links
                          </CardTitle>
                          <CardDescription>
                            Share the participant link with your interviewee and
                            the observer link with team members who want to
                            watch.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${isExpired ? "cursor-default opacity-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                                >
                                  {isExpired ? (
                                    <>
                                      <User className="h-4 w-4 shrink-0" />
                                      <span className="flex-1 font-medium">
                                        Participant
                                      </span>
                                    </>
                                  ) : (
                                    <Link
                                      href={`/session/interview/${session.participantLink}`}
                                      className="flex flex-1 items-center gap-2"
                                      target="_blank"
                                    >
                                      <User className="h-4 w-4 shrink-0" />
                                      <span className="font-medium">
                                        Participant
                                      </span>
                                    </Link>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isExpired}
                                    onClick={() =>
                                      copyLink(
                                        session.participantLink,
                                        "Participant",
                                      )
                                    }
                                    className="ml-auto rounded p-1 hover:bg-zinc-200 disabled:pointer-events-none dark:hover:bg-zinc-700"
                                  >
                                    {copiedLink === session.participantLink ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="text-muted-foreground h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </TooltipTrigger>
                              {isExpired && (
                                <TooltipContent>
                                  This interview&apos;s end date has passed
                                </TooltipContent>
                              )}
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${session.status === "LIVE" && !isExpired ? "hover:bg-zinc-50 dark:hover:bg-zinc-800" : "cursor-default opacity-50"}`}
                                >
                                  {session.status === "LIVE" && !isExpired ? (
                                    <Link
                                      href={`/session/interview/${session.observerLink}`}
                                      className="flex flex-1 items-center gap-2"
                                      target="_blank"
                                    >
                                      <Eye className="h-4 w-4 shrink-0" />
                                      <span className="font-medium">
                                        Observer
                                      </span>
                                    </Link>
                                  ) : (
                                    <>
                                      <Eye className="h-4 w-4 shrink-0" />
                                      <span className="flex-1 font-medium">
                                        Observer
                                      </span>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    disabled={
                                      session.status !== "LIVE" || isExpired
                                    }
                                    onClick={() =>
                                      copyLink(session.observerLink, "Observer")
                                    }
                                    className="ml-auto rounded p-1 hover:bg-zinc-200 disabled:pointer-events-none dark:hover:bg-zinc-700"
                                  >
                                    {copiedLink === session.observerLink ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="text-muted-foreground h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </TooltipTrigger>
                              {isExpired && (
                                <TooltipContent>
                                  This interview&apos;s end date has passed
                                </TooltipContent>
                              )}
                              {!isExpired && session.status !== "LIVE" && (
                                <TooltipContent>
                                  Observer link is available once the session is
                                  live
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        </CardContent>
                      </Card>
                      {session.status === "SCHEDULED" && (
                        <p className="py-2 text-zinc-500">
                          There is no data for this session yet. Share the
                          participant link to begin.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Audio recording */}
                      {session.recordingUrl && (
                        <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900/50">
                          <audio
                            controls
                            className="w-full"
                            src={session.recordingUrl}
                          />
                        </div>
                      )}
                      {session.messages && session.messages.length > 0 ? (
                        <div className="max-h-[400px] divide-y divide-zinc-100 overflow-y-auto rounded-lg border dark:divide-zinc-800/50">
                          {session.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className="flex gap-3 px-4 py-2.5"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2">
                                <span
                                  className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-none font-medium ${
                                    msg.speaker === "AI"
                                      ? "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"
                                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                  }`}
                                >
                                  {msg.speaker === "AI" ? (
                                    <MessageSquare className="h-2.5 w-2.5" />
                                  ) : (
                                    <Mic className="h-2.5 w-2.5" />
                                  )}
                                  {msg.speaker === "AI"
                                    ? "Moderator"
                                    : "Participant"}
                                </span>
                                <span className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                                  {msg.text}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground py-2 text-sm">
                          No transcript available for this session.
                        </p>
                      )}
                    </>
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
                  disabled={!isCreator || creatingSession || !interviewId}
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
