"use client";

import { useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { logger } from "@/apps/shared/logger";
import { updateLiveSessionStatus } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import type { LiveSessionData } from "./constants";
import { CustomerView } from "./customer-view";
import { InterviewerView } from "./interviewer-view";
import { ObserverView } from "./observer-view";

interface LiveSessionRoomProps {
  token: string;
  wsUrl: string;
  role: "INTERVIEWER" | "CUSTOMER" | "OBSERVER";
  session: LiveSessionData;
}

export function LiveSessionRoom({
  token,
  wsUrl,
  role,
  session,
}: LiveSessionRoomProps) {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 p-4">
        <div className="max-w-md rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-400">
            Connection Error
          </h2>
          <p className="text-sm text-zinc-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={role !== "OBSERVER"}
      audio={role !== "OBSERVER"}
      token={token}
      serverUrl={wsUrl}
      connect={true}
      data-lk-theme="default"
      onError={(err) => {
        // Only show fatal connection errors — don't unmount the room for transient issues
        logger.warn("LiveKit error", {
          error: err.message,
          role,
          sessionId: session.id,
        });
        const msg = err.message?.toLowerCase() ?? "";
        // Only show fatal connection/auth errors — publish failures are non-fatal
        if (
          msg.includes("could not connect") ||
          (msg.includes("token") && !msg.includes("publish"))
        ) {
          setError(err);
        }
      }}
      onDisconnected={() => {
        logger.info("Disconnected from live session", {
          sessionId: session.id,
          role,
        });
      }}
      onConnected={() => {
        logger.info("Connected to live session", {
          sessionId: session.id,
          role,
        });
        // Auto-transition session to LIVE when interviewer connects
        if (role === "INTERVIEWER" && session.status === "SCHEDULED") {
          updateLiveSessionStatus(session.id, "LIVE").catch(() => {});
        }
      }}
      className="flex h-screen w-full flex-col bg-zinc-950 font-sans text-zinc-100"
    >
      {role === "CUSTOMER" ? (
        <CustomerView session={session} />
      ) : role === "OBSERVER" ? (
        <ObserverView session={session} />
      ) : (
        <InterviewerView session={session} />
      )}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
