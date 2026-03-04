"use client";

import { useParticipants } from "@livekit/components-react";
import { Eye } from "lucide-react";

/**
 * Displays the number of hidden observers to the interviewer.
 * Observers are connected with `hidden: true` in their LiveKit token,
 * but we can still count them via metadata or by counting non-publishing participants.
 */
export function ObserverCount() {
  const participants = useParticipants();

  // Observers are participants that are NOT publishing any audio or video tracks.
  // They join with canPublish: false, so they have no tracks.
  const observers = participants.filter((p) => {
    const hasAudioOrVideo =
      p.audioTrackPublications.size > 0 || p.videoTrackPublications.size > 0;
    return !hasAudioOrVideo && p.identity.startsWith("observer");
  });

  const count = observers.length;

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
      <Eye className="h-3.5 w-3.5" />
      <span>
        {count} Observer{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
