"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
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
import { InlineActionButton } from "@/apps/nextjs-app/components/ui/inline-action-button";
import {
  Plus,
  User,
  Users,
  Eye,
  FileText,
  Copy,
  CheckCircle2,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  BarChart3,
  AlertTriangle,
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
import { useTeamBalance } from "@/apps/nextjs-app/components/layout/team-balance-context";

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
  balanceCents: number;
  sessionCostCents: number;
  canPurchaseCredits?: boolean;
}

export function LiveSessionsList({
  studyId,
  initialSessions,
  hasAnalysis,
  isCreator,
  renameLiveSession,
  deleteLiveSessionAction,
  balanceCents,
  sessionCostCents,
  canPurchaseCredits,
}: LiveSessionsListProps) {
  const tShared = useTranslations("SharedStudyComponents.insufficientFunds");
  const t = useTranslations("LiveDetail");
  const locale = useLocale();
  const [sessions, setSessions] = useState(initialSessions);
  const [balance, setBalance] = useState(balanceCents);
  const { adjustBalance } = useTeamBalance();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisQueued, setAnalysisQueued] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
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
        toast.success(t("analysisStarted"));
      } else {
        toast.error(result.error || t("failedToStartAnalysis"));
      }
    } catch {
      toast.error(t("failedToStartAnalysis"));
    } finally {
      setAnalyzing(false);
    }
  }, [studyId, t]);

  const handleCreateSession = useCallback(async () => {
    setCreatingSession(true);
    try {
      const newSessions = await createLiveSessionRecords(studyId, 1);
      if (newSessions?.length) {
        const updated = await pollLiveStudySessions(studyId);
        if (updated) setSessions(updated);
        setBalance((prev) => prev - sessionCostCents);
        adjustBalance(-sessionCostCents);
        toast.success(t("sessionCreated"));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("failedToCreateSession");
      toast.error(message);
    } finally {
      setCreatingSession(false);
    }
  }, [studyId, sessionCostCents, adjustBalance, t]);

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
        toast.error(t("failedToRenameSession"));
      }
    },
    [sessions, renameLiveSession, t],
  );

  const handleDelete = useCallback(
    async (sessionId: string) => {
      const wasScheduled =
        sessions.find((s) => s.id === sessionId)?.status === "SCHEDULED";
      setDeletingId(sessionId);
      const result = await deleteLiveSessionAction(sessionId);
      setDeletingId(null);
      setConfirmDeleteId(null);

      if (result.success) {
        setRemovedIds((prev) => new Set([...prev, sessionId]));
        if (wasScheduled) {
          setBalance((prev) => prev + sessionCostCents);
          adjustBalance(sessionCostCents);
        }
        toast.success(t("sessionDeleted"));
      } else {
        toast.error(t("failedToDeleteSession"));
      }
    },
    [deleteLiveSessionAction, sessions, sessionCostCents, adjustBalance, t],
  );

  const hasInsufficientFunds = balance < sessionCostCents;

  return (
    <div>
      {/* Insufficient funds banner */}
      {hasInsufficientFunds && isCreator && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400">
              {tShared("sessionBanner", {
                cost: new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: "USD",
                }).format(sessionCostCents / 100),
                balance: new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: "USD",
                }).format(balance / 100),
              })}
            </p>
          </div>
          {canPurchaseCredits && (
            <Link
              href={locale === "en" ? "/funds" : `/${locale}/funds`}
              className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
            >
              {tShared("manageFunds")}
            </Link>
          )}
        </div>
      )}
      {/* Analysis banner — shown when all sessions are done but analysis hasn't been run */}
      {allComplete && !hasAnalysis && !analysisQueued && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-gradient-to-r from-violet-50 via-pink-50 to-white px-4 py-3 dark:border-zinc-700 dark:from-violet-950/30 dark:via-pink-950/20 dark:to-zinc-900">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {t("allSessionsCompleteRunAnalysis")}
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
                  {t("runAnalysis")}
                </Button>
              </span>
            </TooltipTrigger>
            {!isCreator && (
              <TooltipContent>
                {t("onlyCreatorCanRunAnalysis")}
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      )}

      {analysisQueued && !hasAnalysis && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-zinc-200 bg-gradient-to-r from-violet-50 via-pink-50 to-white px-4 py-3 dark:border-zinc-700 dark:from-violet-950/30 dark:via-pink-950/20 dark:to-zinc-900">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {t("analysisRunning")}
          </p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("sessions")}
        </h3>
        <div className="flex items-center gap-3">
          <span className="flex items-baseline gap-1">
            <span className="text-4xl text-zinc-500">
              {visibleSessions.length}
            </span>
            <span className="text-zinc-500">
              {t("sessionLabelPlural", { count: visibleSessions.length })}
            </span>
          </span>
          <span className="hidden items-baseline gap-1 sm:flex">
            <span className="text-4xl text-zinc-500">{completedCount}</span>
            <span className="text-zinc-500">{t("complete")}</span>
          </span>
          {hasAnalysis ? (
            <Button size="sm" asChild>
              <Link href={`/analysis/${studyId}`}>
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("viewAnalysis")}</span>
              </Link>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={!isCreator ? 0 : undefined}>
                  <Button
                    size="sm"
                    disabled={
                      !isCreator || creatingSession || hasInsufficientFunds
                    }
                    onClick={handleCreateSession}
                  >
                    {creatingSession ? (
                      <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">{t("newSession")}</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {!isCreator && (
                <TooltipContent>
                  {t("onlyCreatorCanCreateSessions")}
                </TooltipContent>
              )}
              {isCreator && hasInsufficientFunds && (
                <TooltipContent>
                  {tShared("insufficientFundsTooltip")}
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
                            session.name || t("sessionLabel", { number: index + 1 }),
                          );
                          setEditingId(session.id);
                        }
                      }}
                    >
                      <span className="text-left text-base font-bold">
                        {session.name || t("sessionLabel", { number: index + 1 })}
                      </span>
                      <InlineActionButton
                        action="edit"
                        showOnHoverClass="group-hover/trigger:opacity-100"
                        className="max-md:pointer-events-none max-md:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingValue(
                            session.name || t("sessionLabel", { number: index + 1 }),
                          );
                          setEditingId(session.id);
                        }}
                      />
                      <InlineActionButton
                        action="delete"
                        showOnHoverClass="group-hover/trigger:opacity-100"
                        className="max-md:pointer-events-none max-md:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(session.id);
                        }}
                      />
                    </div>
                  )}
                  {/* Status badge on the right */}
                  <div className="mr-2 ml-auto shrink-0">
                    {session.status === "SCHEDULED" && (
                      <Badge variant="outline" className="text-xs">
                        {t("statusScheduled")}
                      </Badge>
                    )}
                    {session.status === "LIVE" && (
                      <Badge
                        variant="default"
                        className="bg-red-600 text-xs hover:bg-red-600"
                      >
                        <span className="relative mr-1.5 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        {t("statusLive")}
                      </Badge>
                    )}
                    {session.status === "ENDED" && (
                      <Badge variant="secondary" className="text-xs">
                        {t("statusEnded")}
                      </Badge>
                    )}
                    {session.status === "PROCESSING" && (
                      <Badge variant="secondary" className="text-xs">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {t("statusProcessing")}
                      </Badge>
                    )}
                    {session.status === "COMPLETED" && (
                      <Badge variant="default" className="text-xs">
                        {t("statusCompleted")}
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
                            {t("sessionLinks")}
                          </CardTitle>
                          <CardDescription>
                            {t("sessionLinksDescription")}
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
                                    {t("roleInterviewer")}
                                  </span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/session/${session.interviewerLink}`,
                                    );
                                    setCopiedLink(session.interviewerLink);
                                    toast.success(t("copiedInterviewerLink"));
                                    setTimeout(() => setCopiedLink(null), 2000);
                                  }}
                                  className="ml-auto rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                >
                                  {copiedLink === session.interviewerLink ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="text-muted-foreground h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div
                                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm opacity-50"
                                title={t("onlyCreatorCanJoinInterviewer")}
                              >
                                <User className="h-4 w-4" />
                                <span className="font-medium">{t("roleInterviewer")}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                              <Link
                                href={`/session/${session.observerLink}`}
                                className="flex flex-1 items-center gap-2"
                                target="_blank"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="font-medium">{t("roleObserver")}</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/session/${session.observerLink}`,
                                  );
                                  setCopiedLink(session.observerLink);
                                  toast.success(t("copiedObserverLink"));
                                  setTimeout(() => setCopiedLink(null), 2000);
                                }}
                                className="ml-auto rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                              >
                                {copiedLink === session.observerLink ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="text-muted-foreground h-4 w-4" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                              <Link
                                href={`/session/${session.customerLink}`}
                                className="flex flex-1 items-center gap-2"
                                target="_blank"
                              >
                                <Users className="h-4 w-4" />
                                <span className="font-medium">{t("roleParticipant")}</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/session/${session.customerLink}`,
                                  );
                                  setCopiedLink(session.customerLink);
                                  toast.success(t("copiedParticipantLink"));
                                  setTimeout(() => setCopiedLink(null), 2000);
                                }}
                                className="ml-auto rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                              >
                                {copiedLink === session.customerLink ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="text-muted-foreground h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      {session.status === "SCHEDULED" && (
                        <p className="py-2 text-zinc-500">
                          {t("noDataYet")}
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
            {t("noSessionsCreated")}
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
                  {t("createFirstSession")}
                </Button>
              </span>
            </TooltipTrigger>
            {!isCreator && (
              <TooltipContent>
                {t("onlyCreatorCanCreateSessions")}
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
            <DialogTitle>{t("deleteSession")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deletingId !== null}
            >
              {t("cancel")}
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
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
