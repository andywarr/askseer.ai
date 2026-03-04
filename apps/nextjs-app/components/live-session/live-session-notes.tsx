"use client";

import { useState, useEffect } from "react";
import { useRoomContext, useDataChannel } from "@livekit/components-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { createLiveSessionNote } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface LiveSessionNotesProps {
  sessionId: string;
  startTime: number;
}

export function LiveSessionNotes({
  sessionId,
  startTime,
}: LiveSessionNotesProps) {
  const room = useRoomContext();
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for backroom notes received over data channel
  const [backroomNotes, setBackroomNotes] = useState<
    Array<{ text: string; timestamp: number; sender?: string }>
  >([]);

  const onMessage = (msg: any) => {
    try {
      const payload = msg.payload || msg; // Handle different LiveKit versions
      const decoded = new TextDecoder().decode(payload);
      const data = JSON.parse(decoded);
      if (data.type === "SESSION_NOTE") {
        setBackroomNotes((prev) => [
          ...prev,
          {
            text: data.text,
            timestamp: data.timestamp,
            sender: msg.from?.identity || "Unknown",
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to decode info", err);
    }
  };

  useDataChannel("backroom", onMessage);

  const handleSubmit = async () => {
    if (!note.trim()) return;

    try {
      setIsSubmitting(true);
      const timestamp = (Date.now() - startTime) / 1000;

      // Save to database
      await createLiveSessionNote(sessionId, note, timestamp);

      // Clear input
      setNote("");

      // Optional: Broadcast note to other observers (like a backroom chat)
      const strData = JSON.stringify({
        type: "SESSION_NOTE",
        text: note,
        timestamp,
      });
      const encoder = new TextEncoder();
      // Use a specific topic "backroom" so only observers or interviewers receive it
      await room.localParticipant.publishData(encoder.encode(strData), {
        reliable: true,
        topic: "backroom",
      });
    } catch (error) {
      toast.error("Failed to save note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
        Timestamped Notes
      </div>

      <div className="bg-muted/30 text-muted-foreground flex min-h-[100px] flex-1 flex-col gap-2 overflow-y-auto rounded border p-2 text-sm">
        {backroomNotes.length === 0 ? (
          <div className="mt-4 text-center text-xs italic">
            Notes will appear here and in the synthesis page after the session.
          </div>
        ) : (
          backroomNotes.map((n, i) => (
            <div key={i} className="bg-muted rounded p-2 text-xs">
              <span className="text-muted-foreground mr-2 font-semibold">
                {n.sender}
              </span>
              {n.text}
            </div>
          ))
        )}
      </div>

      <div className="relative mt-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a timestamped note... (Enter to save)"
          className="min-h-[80px] resize-none pr-10 text-sm"
          disabled={isSubmitting}
        />
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground absolute right-2 bottom-2 h-6 w-6"
          onClick={handleSubmit}
          disabled={isSubmitting || !note.trim()}
        >
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
