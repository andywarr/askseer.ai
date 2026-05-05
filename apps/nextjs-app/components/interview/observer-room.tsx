"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  getInterviewMessages,
  sendInterviewProbe,
} from "@/apps/nextjs-app/lib/actions/interview-actions";
import {
  Send,
  Loader2,
  Mic,
  MessageSquare,
  Clock,
  Eye,
  Radio,
} from "lucide-react";

interface ObserverRoomProps {
  session: any;
  token: string;
}

interface TranscriptMessage {
  id: string;
  speaker: string;
  text: string;
  createdAt: string;
}

// A probe sent by the observer — shown inline in the transcript
interface ProbeEntry {
  id: string;
  speaker: "PROBE";
  text: string;
  createdAt: string;
}

type ChatEntry = TranscriptMessage | ProbeEntry;

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function InterviewObserverRoom({ session, token }: ObserverRoomProps) {
  const [entries, setEntries] = useState<ChatEntry[]>(session.messages || []);
  const [probeText, setProbeText] = useState("");
  const [sendingProbe, setSendingProbe] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>(session.status);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const lastMessageIdRef = useRef<string | null>(
    session.messages?.length > 0
      ? session.messages[session.messages.length - 1].id
      : null,
  );
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [entries]);

  // Elapsed-time ticker — starts from session.startedAt if available, otherwise 0
  useEffect(() => {
    if (sessionStatus !== "LIVE") return;

    const startedAt = session.startedAt
      ? new Date(session.startedAt).getTime()
      : Date.now();

    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionStatus, session.startedAt]);

  // Poll for new messages every 3s
  useEffect(() => {
    if (session.status === "COMPLETED") return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const result = await getInterviewMessages(
          session.id,
          lastMessageIdRef.current || undefined,
        );
        if (result.success && result.data && result.data.length > 0) {
          setEntries((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMessages = (result.data as TranscriptMessage[]).filter(
              (m) => !existingIds.has(m.id),
            );
            if (newMessages.length > 0) {
              lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
              setSessionStatus("LIVE");
            }
            return [...prev, ...newMessages];
          });
        }
      } catch (e) {
        // Silent fail for polling
      }
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [session.id, session.status]);

  const handleSendProbe = useCallback(async () => {
    if (!probeText.trim() || sendingProbe) return;

    setSendingProbe(true);
    const text = probeText.trim();
    try {
      const result = await sendInterviewProbe(session.id, text);
      if (result.success) {
        toast.success("Probe sent to AI moderator");
        setProbeText("");
        // Add the probe inline so the observer can see their own instruction
        setEntries((prev) => [
          ...prev,
          {
            id: `probe-${Date.now()}`,
            speaker: "PROBE",
            text,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        toast.error(result.error || "Failed to send probe");
      }
    } catch (error) {
      toast.error("Failed to send probe");
    } finally {
      setSendingProbe(false);
    }
  }, [probeText, sendingProbe, session.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendProbe();
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Timer + status bar — mirrors participant view, no logo header */}
      <div className="flex w-full items-center justify-between px-6 pt-5 pb-2">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-zinc-400" />
          <span className="text-zinc-400">
            {sessionStatus === "LIVE"
              ? formatTime(elapsedSeconds)
              : sessionStatus === "COMPLETED"
                ? "Completed"
                : "Waiting"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sessionStatus === "LIVE" ? (
            <>
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-xs text-green-400">LIVE</span>
            </>
          ) : sessionStatus === "COMPLETED" ? (
            <span className="text-xs text-zinc-500">COMPLETED</span>
          ) : (
            <>
              <Eye className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">OBSERVER</span>
            </>
          )}
        </div>
      </div>

      {/* Transcript */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div
          ref={transcriptRef}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3"
        >
          {entries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Eye className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                <p className="text-muted-foreground">
                  {session.status === "SCHEDULED"
                    ? "Waiting for participant to start the interview..."
                    : "No messages yet."}
                </p>
              </div>
            </div>
          ) : (
            entries.map((entry) => {
              if (entry.speaker === "PROBE") {
                return (
                  <div key={entry.id} className="flex justify-center">
                    <div className="flex max-w-[80%] items-start gap-2 rounded-xl border border-teal-800/50 bg-teal-900/20 px-4 py-2 text-sm">
                      <Radio className="mt-0.5 h-3 w-3 shrink-0 text-teal-400" />
                      <div>
                        <span className="text-[10px] font-medium text-teal-400 uppercase opacity-80">
                          Observer probe
                        </span>
                        <p className="text-teal-200">{entry.text}</p>
                      </div>
                    </div>
                  </div>
                );
              }

              const msg = entry as TranscriptMessage;
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.speaker === "PARTICIPANT" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                      msg.speaker === "PARTICIPANT"
                        ? "bg-violet-600/20 text-violet-200"
                        : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {msg.speaker === "AI" ? (
                        <MessageSquare className="h-3 w-3 opacity-50" />
                      ) : (
                        <Mic className="h-3 w-3 opacity-50" />
                      )}
                      <span className="text-[10px] font-medium uppercase opacity-60">
                        {msg.speaker === "AI" ? "AI Moderator" : "Participant"}
                      </span>
                      <span className="text-[10px] opacity-30">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p>{msg.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Probe Input */}
        {session.status !== "COMPLETED" && (
          <div className="shrink-0 border-t border-zinc-800 px-4 py-4">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
                <input
                  type="text"
                  value={probeText}
                  onChange={(e) => setProbeText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a probing question to the AI moderator..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
                  disabled={sendingProbe}
                />
                <button
                  type="button"
                  onClick={handleSendProbe}
                  disabled={sendingProbe || !probeText.trim()}
                  className="rounded p-1 text-zinc-400 transition-colors hover:text-teal-400 disabled:opacity-30"
                >
                  {sendingProbe ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-muted-foreground mt-2 text-center text-xs">
                Probes are injected as hidden instructions to the AI moderator.
                The participant won&apos;t see them.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
