"use client";

import { useState, useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Monitor, MonitorOff } from "lucide-react";
import { toast } from "sonner";

interface ScreenShareButtonProps {
  variant?: "default" | "compact";
}

/**
 * Bi-directional screenshare button. Works for both interviewer and customer.
 * Uses LiveKit's built-in screen capture API.
 */
export function ScreenShareButton({
  variant = "default",
}: ScreenShareButtonProps) {
  const { localParticipant } = useLocalParticipant();
  const [isSharing, setIsSharing] = useState(false);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isSharing) {
        await localParticipant.setScreenShareEnabled(false);
        setIsSharing(false);
      } else {
        await localParticipant.setScreenShareEnabled(true);
        setIsSharing(true);
      }
    } catch (error: any) {
      // User cancelled the screen share picker — not an error
      if (error?.name === "NotAllowedError") {
        return;
      }
      toast.error("Failed to toggle screen share");
    }
  }, [isSharing, localParticipant]);

  // Listen for screen share ending externally (e.g., browser "Stop sharing" button)
  const screenShareTrack = localParticipant
    .getTrackPublications()
    .find((t) => t.source === Track.Source.ScreenShare);

  // Sync state if screen share was stopped externally
  if (!screenShareTrack && isSharing) {
    setIsSharing(false);
  }

  if (variant === "compact") {
    return (
      <Button
        variant={isSharing ? "destructive" : "secondary"}
        size="icon"
        className="h-8 w-8"
        onClick={toggleScreenShare}
        title={isSharing ? "Stop sharing" : "Share screen"}
      >
        {isSharing ? (
          <MonitorOff className="h-4 w-4" />
        ) : (
          <Monitor className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={isSharing ? "destructive" : "secondary"}
      size="sm"
      className="flex h-7 items-center gap-1.5 text-xs"
      onClick={toggleScreenShare}
    >
      {isSharing ? (
        <>
          <MonitorOff className="h-3 w-3" />
          Stop Sharing
        </>
      ) : (
        <>
          <Monitor className="h-3 w-3" />
          Share Screen
        </>
      )}
    </Button>
  );
}
