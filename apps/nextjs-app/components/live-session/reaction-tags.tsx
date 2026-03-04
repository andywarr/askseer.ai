"use client";

import { useState } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Bug, Lightbulb, AlertTriangle, Zap, Check } from "lucide-react";
import { createLiveSessionTag } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { toast } from "sonner";
import { useRoomContext } from "@livekit/components-react";

export type ReactionTagType = "BUG" | "IDEA" | "PAIN_POINT" | "INSIGHT";

interface ReactionTagsProps {
  sessionId: string;
  startTime: number; // The recording start time, or session join time for now
}

const TAG_CONFIG = [
  {
    type: "BUG" as ReactionTagType,
    label: "Bug",
    icon: Bug,
    color: "text-red-500",
    bg: "hover:bg-red-500/10",
  },
  {
    type: "PAIN_POINT" as ReactionTagType,
    label: "Pain",
    icon: AlertTriangle,
    color: "text-orange-500",
    bg: "hover:bg-orange-500/10",
  },
  {
    type: "IDEA" as ReactionTagType,
    label: "Idea",
    icon: Lightbulb,
    color: "text-amber-500",
    bg: "hover:bg-amber-500/10",
  },
  {
    type: "INSIGHT" as ReactionTagType,
    label: "Insight",
    icon: Zap,
    color: "text-purple-500",
    bg: "hover:bg-purple-500/10",
  },
];

export function ReactionTags({ sessionId, startTime }: ReactionTagsProps) {
  const room = useRoomContext();
  const [activeTag, setActiveTag] = useState<ReactionTagType | null>(null);

  const handleCreateTag = async (tagType: ReactionTagType) => {
    try {
      // Calculate timestamp in seconds from start
      const timestamp = (Date.now() - startTime) / 1000;

      // Visual feedback
      setActiveTag(tagType);
      setTimeout(() => setActiveTag(null), 1000);

      // Save to database
      await createLiveSessionTag(sessionId, tagType, timestamp);

      // Optional: Broadcast tag to other participants via LiveKit data channel
      // so they see a little floating icon/notification
      const strData = JSON.stringify({
        type: "REACTION_TAG",
        tagType,
        timestamp,
      });
      const encoder = new TextEncoder();
      await room.localParticipant.publishData(encoder.encode(strData), {
        reliable: true,
      });
    } catch (error) {
      toast.error("Failed to save tag");
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
        Quick Tags
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TAG_CONFIG.map(({ type, label, icon: Icon, color, bg }) => {
          const isActive = activeTag === type;
          return (
            <Button
              key={type}
              variant="outline"
              className={`flex h-12 flex-col items-center justify-center gap-1 ${bg} ${isActive ? "border-primary scale-95" : ""} transition-all`}
              onClick={() => handleCreateTag(type)}
            >
              {isActive ? (
                <Check className={`h-4 w-4 ${color}`} />
              ) : (
                <Icon className={`h-4 w-4 ${color}`} />
              )}
              <span className="text-muted-foreground text-[10px]">{label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
