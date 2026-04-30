"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  getInterviewMessages,
  sendInterviewProbe,
} from "@/apps/nextjs-app/lib/actions/interview-actions";
import { Eye, Send, Loader2, Mic, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";

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

export function InterviewObserverRoom({ session, token }: ObserverRoomProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>(
    session.messages || [],
  );
  const [probeText, setProbeText] = useState("");
  const [sendingProbe, setSendingProbe] = useState(false);
  const [isLive, setIsLive] = useState(session.status === "LIVE");

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const lastMessageIdRef = useRef<string | null>(
    messages.length > 0 ? messages[messages.length - 1].id : null,
  );
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

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
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMessages = result.data!.filter(
              (m: TranscriptMessage) => !existingIds.has(m.id),
            );
            if (newMessages.length > 0) {
              lastMessageIdRef.current =
                newMessages[newMessages.length - 1].id;
              setIsLive(true);
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
    try {
      const result = await sendInterviewProbe(session.id, probeText.trim());
      if (result.success) {
        toast.success("Probe sent to AI moderator");
        setProbeText("");
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
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
            <Eye className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium">Observer View</span>
        </div>

        <div className="flex items-center gap-3">
          {isLive ? (
            <>
              <div className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">LIVE</span>
            </>
          ) : session.status === "COMPLETED" ? (
            <span className="text-xs text-zinc-500">COMPLETED</span>
          ) : (
            <>
              <Clock className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">WAITING</span>
            </>
          )}
        </div>
      </header>

      {/* Transcript */}
      <main className="flex flex-1 flex-col">
        <div
          ref={transcriptRef}
          className="flex-1 space-y-2 overflow-y-auto p-4"
          style={{ maxHeight: "calc(100vh - 120px)" }}
        >
          {messages.length === 0 ? (
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
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.speaker === "PARTICIPANT" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                    msg.speaker === "PARTICIPANT"
                      ? "bg-violet-600/20 text-violet-200"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-2">
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
            ))
          )}
        </div>

        {/* Probe Input */}
        {session.status !== "COMPLETED" && (
          <div className="border-t border-zinc-800 p-4">
            <div className="mx-auto flex max-w-2xl gap-2">
              <Input
                value={probeText}
                onChange={(e) => setProbeText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a probe to the AI moderator..."
                className="flex-1 border-zinc-700 bg-zinc-900"
                disabled={sendingProbe}
              />
              <Button
                size="sm"
                onClick={handleSendProbe}
                disabled={sendingProbe || !probeText.trim()}
                className="gap-2"
              >
                {sendingProbe ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Probes are injected as hidden instructions to the AI moderator.
              The participant won&apos;t see them.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
