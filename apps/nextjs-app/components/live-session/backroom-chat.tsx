"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRoomContext, useDataChannel } from "@livekit/components-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { ScrollArea } from "@/apps/nextjs-app/components/ui/scroll-area";
import {
  createBackroomMessage,
  getBackroomMessages,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface BackroomChatProps {
  sessionId: string;
  startTime: number;
}

interface ChatMessage {
  id?: string;
  text: string;
  displayName: string;
  timestamp: number;
  createdAt?: string;
}

export function BackroomChat({ sessionId, startTime }: BackroomChatProps) {
  const room = useRoomContext();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing messages on mount
  useEffect(() => {
    async function loadMessages() {
      try {
        const existing = await getBackroomMessages(sessionId);
        if (existing && Array.isArray(existing)) {
          setMessages(
            existing.map((m: any) => ({
              id: m.id,
              text: m.text,
              displayName: m.user?.name || "Anonymous",
              timestamp: m.timestamp,
              createdAt: m.createdAt,
            })),
          );
        }
      } catch {
        // Silently fail — messages will come via data channel
      }
    }
    loadMessages();
  }, [sessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for incoming backroom chat via LiveKit data channel
  const onChatMessage = useCallback((msg: any) => {
    try {
      const payload = msg.payload || msg;
      const decoded = new TextDecoder().decode(payload);
      const data = JSON.parse(decoded);
      if (data.type === "BACKROOM_CHAT") {
        setMessages((prev) => {
          // Deduplicate by checking if we already have this message
          const isDuplicate = prev.some(
            (m) =>
              m.text === data.text &&
              m.displayName === data.displayName &&
              Math.abs(m.timestamp - data.timestamp) < 0.5,
          );
          if (isDuplicate) return prev;
          return [
            ...prev,
            {
              text: data.text,
              displayName: data.displayName,
              timestamp: data.timestamp,
            },
          ];
        });
      }
    } catch {
      // Ignore decode errors
    }
  }, []);

  useDataChannel("backroom-chat", onChatMessage);

  const handleSend = async () => {
    if (!message.trim()) return;

    const timestamp = (Date.now() - startTime) / 1000;
    const displayName = room.localParticipant.name || "Team Member";
    const newMsg: ChatMessage = {
      text: message.trim(),
      displayName,
      timestamp,
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, newMsg]);
    const msgText = message.trim();
    setMessage("");

    try {
      setIsSubmitting(true);

      // Persist to database
      await createBackroomMessage(sessionId, msgText, timestamp);

      // Broadcast to other observers/interviewers via data channel
      const strData = JSON.stringify({
        type: "BACKROOM_CHAT",
        text: msgText,
        displayName,
        timestamp,
      });
      const encoder = new TextEncoder();
      await room.localParticipant.publishData(encoder.encode(strData), {
        reliable: true,
        topic: "backroom-chat",
      });
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(startTime + ts * 1000);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Hidden-from-participant pill */}
      <div className="flex items-center justify-center px-4 py-2">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
          Hidden from participant
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-xs text-zinc-500 italic">
              Chat with your team here. This is invisible to participants.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    {msg.displayName}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-zinc-300">{msg.text}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your team..."
            className="h-8 border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-500"
            disabled={isSubmitting}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={handleSend}
            disabled={isSubmitting || !message.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
