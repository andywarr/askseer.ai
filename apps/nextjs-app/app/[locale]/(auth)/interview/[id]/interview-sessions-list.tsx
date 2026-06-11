"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  Globe,
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
import { useTranslationContext } from "@/apps/nextjs-app/components/i18n/translation-context";
import { getCachedTranslation, setCachedTranslation } from "@/apps/nextjs-app/components/i18n/translation-wrapper";
import { translateMessages } from "@/apps/nextjs-app/lib/actions/translate-actions";

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
  locale?: string | null;
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

interface InterviewSessionMessagesProps {
  sessionId: string;
  messages: InterviewMessage[];
  sessionLocale: string;
}

function InterviewSessionMessages({
  sessionId,
  messages,
  sessionLocale,
}: InterviewSessionMessagesProps) {
  const t = useTranslations("InterviewDetail");
  const tTrans = useTranslations("Translation");
  const activeLocale = useLocale();
  const context = useTranslationContext();

  const hasLocaleMismatch = sessionLocale !== activeLocale;

  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string> | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [loading, setLoading] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check cache for each message when messages or activeLocale changes
  useEffect(() => {
    if (!messages || messages.length === 0 || !hasLocaleMismatch) {
      setTranslatedMessages(null);
      return;
    }

    const cached: Record<string, string> = {};
    let allCached = true;
    for (const msg of messages) {
      const cacheKey = `${activeLocale}:${msg.text}`;
      const translatedVal = getCachedTranslation(cacheKey);
      if (translatedVal) {
        cached[msg.id] = translatedVal;
      } else {
        allCached = false;
      }
    }

    if (allCached && messages.length > 0) {
      setTranslatedMessages(cached);
      setShowOriginal(false);
    } else {
      setTranslatedMessages(null);
      setShowOriginal(true);
    }
  }, [messages, activeLocale, hasLocaleMismatch]);

  const handleTranslate = useCallback(async () => {
    if (!messages || messages.length === 0) return;

    // Check if we can build translations from cache first
    const cached: Record<string, string> = {};
    const missing: Array<{ id: string; text: string }> = [];

    for (const msg of messages) {
      const cacheKey = `${activeLocale}:${msg.text}`;
      const translatedVal = getCachedTranslation(cacheKey);
      if (translatedVal) {
        cached[msg.id] = translatedVal;
      } else {
        missing.push({ id: msg.id, text: msg.text });
      }
    }

    if (missing.length === 0) {
      setTranslatedMessages(cached);
      setShowOriginal(false);
      return;
    }

    setLoading(true);
    try {
      const result = await translateMessages(missing, activeLocale);
      if (!isMountedRef.current) return;
      if (!result.success) {
        toast.error(result.error || t("failedToTranslateTranscript"));
      } else {
        const newTranslations = { ...cached };
        for (const item of result.data || []) {
          newTranslations[item.id] = item.translatedText;
          // Store in sessionStorage cache
          const origMsg = messages.find((m) => m.id === item.id);
          if (origMsg) {
            const cacheKey = `${activeLocale}:${origMsg.text}`;
            setCachedTranslation(cacheKey, item.translatedText);
          }
        }
        setTranslatedMessages(newTranslations);
        setShowOriginal(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        toast.error(t("failedToTranslateTranscript"));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [messages, activeLocale]);

  // Synchronize with global translation context
  useEffect(() => {
    if (context) {
      if (context.isGlobalTranslated && hasLocaleMismatch) {
        if (!translatedMessages && !loading) {
          handleTranslate();
        } else if (translatedMessages) {
          setShowOriginal(false);
        }
      } else {
        setShowOriginal(true);
      }
    }
  }, [context?.isGlobalTranslated, hasLocaleMismatch, translatedMessages, loading, handleTranslate, context]);

  if (!messages || messages.length === 0) {
    return (
      <p className="text-muted-foreground py-2 text-sm">
        {t("noTranscript")}
      </p>
    );
  }

  const getMessageText = (msg: InterviewMessage) => {
    if (showOriginal || !translatedMessages || !translatedMessages[msg.id]) {
      return msg.text;
    }
    return translatedMessages[msg.id];
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Transcript list */}
      <div className={`max-h-[400px] divide-y divide-zinc-100 overflow-y-auto rounded-lg border dark:divide-zinc-800/50 transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}>
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3 px-4 py-2.5">
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
                  ? t("roleModerator")
                  : t("roleParticipant")}
              </span>
              <span className="text-sm leading-snug text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                {getMessageText(msg)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Translation loading / controls */}
      {hasLocaleMismatch && (
        <div className="flex w-full items-center justify-end px-1 py-0.5">
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 select-none">
              <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
              <span>{tTrans("translating")}</span>
            </div>
          )}
          {!loading && !context && showOriginal && (
            <button
              onClick={handleTranslate}
              className="flex w-fit items-center gap-1 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 print:hidden"
            >
              <Globe className="h-3.5 w-3.5 animate-pulse" />
              <span>{tTrans("translateTo", { language: tTrans(`languages.${activeLocale}`) })}</span>
            </button>
          )}
          {!loading && !context && !showOriginal && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 select-none print:hidden">
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                {tTrans("translatedByAi")}
              </span>
              <span>•</span>
              <button
                onClick={() => setShowOriginal(true)}
                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {tTrans("showOriginal")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const t = useTranslations("InterviewDetail");
  const tShared = useTranslations("SharedStudyComponents.insufficientFunds");
  const locale = useLocale();
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

  const copyLink = useCallback(async (link: string, label: string) => {
    const url = `${window.location.origin}/session/interview/${link}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(link);
    const key = label === "Participant" ? "copiedParticipantLink" : "copiedObserverLink";
    toast.success(t(key));
    setTimeout(() => setCopiedLink(null), 2000);
  }, [t]);

  const handleCreateSession = useCallback(async () => {
    if (!interviewId) {
      toast.error(t("interviewNotReady"));
      return;
    }

    setCreatingSession(true);
    try {
      const result = await createInterviewSession(interviewId);
      if (result.success) {
        toast.success(t("sessionCreated"));
        // Refresh interview data to get updated sessions
        const refreshed = await getInterviewData(studyId);
        if (refreshed.success && refreshed.data?.sessions) {
          setSessions(refreshed.data.sessions);
        }
        setBalance((prev) => prev - sessionCostCents);
        adjustBalance(-sessionCostCents);
      } else {
        toast.error(result.error || t("failedToCreateSession"));
      }
    } catch {
      toast.error(t("failedToCreateSession"));
    } finally {
      setCreatingSession(false);
    }
  }, [interviewId, studyId, sessionCostCents, adjustBalance, t]);

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
        toast.success(t("sessionDeleted"));
      } else {
        toast.error(t("failedToDeleteSession"));
      }
    },
    [sessions, sessionCostCents, adjustBalance, t],
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
        toast.error(t("failedToRenameSession"));
      }
    },
    [sessions, t],
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
              href="/funds"
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
      {/* End Date moved to metadata section on study page */}

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
          {completedCount > 0 && (
            <span className="hidden items-baseline gap-1 sm:flex">
              <span className="text-4xl text-zinc-500">{completedCount}</span>
              <span className="text-zinc-500">{t("complete")}</span>
            </span>
          )}
          {liveCount > 0 && (
            <span className="hidden items-baseline gap-1 sm:flex">
              <span className="text-4xl text-green-500">{liveCount}</span>
              <span className="text-green-500">{t("live")}</span>
            </span>
          )}
          {hasAnalysis && (
            <Button size="sm" asChild>
              <Link href={`/analysis/${studyId}`}>
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("viewAnalysis")}</span>
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
                  <span className="hidden sm:inline">{t("newSession")}</span>
                </Button>
              </span>
            </TooltipTrigger>
            {!isCreator && (
              <TooltipContent>
                {t("onlyCreatorCanCreateSessions")}
              </TooltipContent>
            )}
            {isCreator && hasInsufficientFunds && !isExpired && (
              <TooltipContent>
                {tShared("insufficientFundsTooltip")}
              </TooltipContent>
            )}
            {isCreator && isExpired && (
              <TooltipContent>
                {t("interviewExpired")}
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
                        {t("statusScheduled")}
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
                        {t("statusLive")}
                      </Badge>
                    )}
                    {session.status === "COMPLETED" && (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {t("statusCompleted")}
                      </Badge>
                    )}
                    {session.status === "INCOMPLETE" && (
                      <Badge
                        variant="outline"
                        className="border-amber-600 text-xs text-amber-600 dark:border-amber-500 dark:text-amber-500"
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        {t("statusIncomplete")}
                      </Badge>
                    )}
                    {session.status === "PAUSED" && (
                      <Badge
                        variant="outline"
                        className="border-purple-600 text-xs text-purple-600 dark:border-purple-400 dark:text-purple-400"
                      >
                        <Clock className="mr-1 h-3 w-3" />
                        {t("statusPaused")}
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
                            {t("sessionLinks")}
                          </CardTitle>
                          <CardDescription>
                            {t("sessionLinksDescription")}
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
                                        {t("roleParticipant")}
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
                                        {t("roleParticipant")}
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
                                  {t("interviewExpired")}
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
                                        {t("roleObserver")}
                                      </span>
                                    </Link>
                                  ) : (
                                    <>
                                      <Eye className="h-4 w-4 shrink-0" />
                                      <span className="flex-1 font-medium">
                                        {t("roleObserver")}
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
                                  {t("interviewExpired")}
                                </TooltipContent>
                              )}
                              {!isExpired && session.status !== "LIVE" && (
                                <TooltipContent>
                                  {t("observerLinkTooltip")}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        </CardContent>
                      </Card>
                      {session.status === "SCHEDULED" && (
                        <p className="py-2 text-zinc-500">
                          {t("noDataScheduled")}
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
                      <InterviewSessionMessages
                        sessionId={session.id}
                        messages={session.messages || []}
                        sessionLocale={session.locale || "en"}
                      />
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
            {t("noSessionsCreated")}
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
