"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRoomContext, useDataChannel } from "@livekit/components-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { ScrollArea } from "@/apps/nextjs-app/components/ui/scroll-area";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";

interface ChatMessage {
  text: string;
  displayName: string;
  timestamp: number;
}

export function DirectChat() {
  const t = useTranslations("LiveSessionRoom");
  const room = useRoomContext();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for incoming direct chat via LiveKit data channel
  const onChatMessage = useCallback((msg: any) => {
    try {
      const payload = msg.payload || msg;
      const decoded = new TextDecoder().decode(payload);
      const data = JSON.parse(decoded);
      if (data.type === "DIRECT_CHAT") {
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

  useDataChannel("direct-chat", onChatMessage);

  const handleSend = async () => {
    if (!message.trim()) return;

    const timestamp = Date.now();
    const displayName = room.localParticipant.name || t("participantFallback");
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

      // Broadcast via data channel (ephemeral — no DB persistence)
      const strData = JSON.stringify({
        type: "DIRECT_CHAT",
        text: msgText,
        displayName,
        timestamp,
      });
      const encoder = new TextEncoder();
      await room.localParticipant.publishData(encoder.encode(strData), {
        reliable: true,
        topic: "direct-chat",
      });
    } catch {
      // Message already shown optimistically
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

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-xs text-zinc-500 italic">
              {t("directChatEmptyState")}
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
                    {formatTime(msg.timestamp)}
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
            placeholder={t("directChatPlaceholder")}
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
