"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ParticipantTile,
  GridLayout,
  useTracks,
  useRemoteParticipants,
  useDataChannel,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { BackroomChat } from "./backroom-chat";
import { ObserverCount } from "./observer-count";

import { toast } from "sonner";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { Check, LogOut, StickyNote, Loader2, UserX } from "lucide-react";
import { TAG_CONFIG, type LiveSessionData } from "./constants";
import { useSessionActions } from "./hooks/use-session-actions";

export function ObserverView({ session }: { session: LiveSessionData }) {
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  const interviewerPresent = useMemo(
    () => remoteParticipants.some((p) => p.identity.startsWith("interviewer-")),
    [remoteParticipants],
  );

  const customerPresent = useMemo(
    () => remoteParticipants.some((p) => p.identity.startsWith("customer-")),
    [remoteParticipants],
  );

  // Track whether a customer has ever joined (so we can show "left" banner)
  const [customerEverJoined, setCustomerEverJoined] = useState(false);
  if (customerPresent && !customerEverJoined) {
    setCustomerEverJoined(true);
  }

  // Shared tag/note state & handlers
  const {
    showNotes,
    setShowNotes,
    noteText,
    noteInputRef,
    activeTag,
    noteSaved,
    showToolbar,
    setShowToolbar,
    sessionStartTime,
    handleTag,
    handleNoteSubmit,
    handleNoteKeyDown,
    handleNoteChange,
  } = useSessionActions(session);

  // Recording state (received from interviewer via data channel)
  const [isRecording, setIsRecording] = useState(false);
  // Session ended signal (received from interviewer via data channel)
  const [sessionEnded, setSessionEnded] = useState(false);

  // Observer chat tab
  const [chatTab, setChatTab] = useState<"backroom">("backroom");

  const onSessionControl = useCallback((msg: any) => {
    try {
      const payload = msg.payload || msg;
      const decoded = new TextDecoder().decode(payload);
      const data = JSON.parse(decoded);
      if (data.type === "RECORDING_STATE") {
        setIsRecording(data.isRecording);
      } else if (data.type === "SESSION_ENDED") {
        setSessionEnded(true);
      }
    } catch {
      // Ignore decode errors
    }
  }, []);

  useDataChannel("session-control", onSessionControl);

  return interviewerPresent || sessionEnded ? (
    <div className="flex h-screen w-full">
      {/* ── Main Stage (left) ─────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col">
        {/* Video area (view-only) */}
        <div
          className="relative flex-1 cursor-pointer overflow-hidden bg-zinc-950"
          onClick={() => setShowToolbar((v) => !v)}
        >
          {/* Study name overlay */}
          <div className="absolute top-0 left-0 z-10 flex items-center gap-2 px-4 py-2">
            <span className="truncate text-sm font-semibold text-white/80 drop-shadow-md">
              {session.study?.name || "Live Session"}
            </span>
            <span className="text-xs text-white/50 drop-shadow-md">
              (Backroom)
            </span>
            <div className="ml-2">
              <ObserverCount />
            </div>
          </div>

          {/* Floating banner when participant has left */}
          {!customerPresent && customerEverJoined && (
            <div className="absolute top-12 left-1/2 z-20 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2 shadow-lg backdrop-blur">
                <UserX className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-sm text-zinc-300">
                  Participant has left the session
                </span>
              </div>
            </div>
          )}

          {tracks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-zinc-400">
                  Waiting for session to begin…
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Participants will appear here once they join.
                </p>
              </div>
            </div>
          ) : (
            <GridLayout tracks={tracks}>
              <ParticipantTile />
            </GridLayout>
          )}

          {/* ── Floating overlays (center-bottom of video) ────────── */}
          {showToolbar && (
            <div
              className="absolute bottom-16 left-1/2 z-10 inline-grid -translate-x-1/2 gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {showNotes && (
                <Textarea
                  ref={noteInputRef}
                  value={noteText}
                  onChange={handleNoteChange}
                  onKeyDown={handleNoteKeyDown}
                  placeholder="Type a note… (Enter to save, Esc to close)"
                  rows={1}
                  className="max-h-[200px] min-h-9 min-w-0 resize-none overflow-hidden border-zinc-700 bg-zinc-900/90 text-sm text-zinc-100 shadow-lg backdrop-blur"
                />
              )}

              <Tooltip open={!isRecording ? undefined : false}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2 py-1.5 shadow-lg backdrop-blur ${!isRecording ? "opacity-50" : ""}`}
                  >
                    {/* Reaction tags */}
                    {TAG_CONFIG.map(
                      ({ type, label, icon: Icon, color, bg }) => {
                        const isActive = activeTag === type;
                        return (
                          <Button
                            key={type}
                            variant="ghost"
                            size="sm"
                            disabled={!isRecording}
                            className={`h-8 gap-1.5 text-xs ${color} ${bg} ${isActive ? "scale-90" : ""} transition-all`}
                            onClick={() => handleTag(type)}
                          >
                            {isActive ? (
                              <Check className={`h-3.5 w-3.5 ${color}`} />
                            ) : (
                              <Icon className={`h-3.5 w-3.5 ${color}`} />
                            )}
                            {label}
                          </Button>
                        );
                      },
                    )}

                    <div className="mx-1 h-5 w-px bg-zinc-700" />

                    {/* Notes toggle */}
                    <Button
                      variant={showNotes ? "secondary" : "ghost"}
                      size="sm"
                      disabled={!isRecording}
                      className={`h-8 gap-1.5 text-xs ${noteSaved ? "scale-90" : ""} transition-all`}
                      onClick={() => setShowNotes(!showNotes)}
                    >
                      {noteSaved ? (
                        <Check className="h-3.5 w-3.5 text-blue-400" />
                      ) : (
                        <StickyNote className="h-3.5 w-3.5" />
                      )}
                      Notes
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Tags and notes are available once the session starts
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Bottom bar — observer has no controls, just a subtle info strip */}
        <div className="flex h-10 items-center justify-end bg-zinc-950 px-3">
          <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            Observer — Hidden from participant
          </span>
        </div>
      </div>

      {/* ── Chat Sidebar (right) ──────────────────────────────────────── */}
      <div className="hidden w-[328px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950 md:flex">
        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800">
          <div className="flex-1 border-b-2 border-zinc-100 px-4 py-2.5 text-center text-xs font-semibold tracking-wider text-zinc-100 uppercase">
            Backroom
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <BackroomChat sessionId={session.id} startTime={sessionStartTime} />
        </div>
      </div>
    </div>
  ) : session.status === "ENDED" ||
    session.status === "PROCESSING" ||
    session.status === "COMPLETED" ? (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4 text-center">
        <div>
          <p className="text-lg font-semibold text-zinc-200">
            {session.study?.name || "Session"}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            This session has ended. You can close this tab.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 gap-1.5 text-zinc-400 hover:text-zinc-200"
          onClick={() => window.close()}
        >
          <LogOut className="h-4 w-4" />
          Exit
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        <div>
          <p className="text-lg font-semibold text-zinc-200">
            {session.study?.name || "Session"}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            The session will begin when the interviewer arrives
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 gap-1.5 text-zinc-400 hover:text-zinc-200"
          onClick={() => window.close()}
        >
          <LogOut className="h-4 w-4" />
          Exit
        </Button>
      </div>
    </div>
  );
}
