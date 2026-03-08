"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ParticipantTile,
  GridLayout,
  useTracks,
  useLocalParticipant,
  useRemoteParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { logger } from "@/apps/shared/logger";
import { BackroomChat } from "./backroom-chat";
import { DirectChat } from "./direct-chat";

import {
  startLiveSessionRecording,
  stopLiveSessionRecording,
} from "@/apps/nextjs-app/lib/actions/livekit-actions";
import {
  updateLiveSessionStatus,
  setLiveSessionRecordingStarted,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { useRoomContext } from "@livekit/components-react";
import { toast } from "sonner";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/apps/nextjs-app/components/ui/popover";
import { Checkbox } from "@/apps/nextjs-app/components/ui/checkbox";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  LogOut,
  StickyNote,
  Check,
  Square,
  Play,
  Loader2,
} from "lucide-react";
import { TAG_CONFIG, type LiveSessionData } from "./constants";
import { ToolbarButton, useMediaDevices } from "./toolbar";
import { useAutoEnableMedia } from "./hooks/use-auto-enable-media";
import { useSessionActions } from "./hooks/use-session-actions";

export function InterviewerView({ session }: { session: LiveSessionData }) {
  const {
    localParticipant,
    isMicrophoneEnabled: isMicOn,
    isCameraEnabled: isCameraOn,
    isScreenShareEnabled: isSharing,
  } = useLocalParticipant();
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { videoDevices, audioDevices } = useMediaDevices();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  useAutoEnableMedia(localParticipant);

  const customerPresent = useMemo(
    () => remoteParticipants.some((p) => p.identity.startsWith("customer-")),
    [remoteParticipants],
  );

  // Track whether a customer has ever joined (so we don't show "waiting" after they leave)
  const [customerEverJoined, setCustomerEverJoined] = useState(false);
  if (customerPresent && !customerEverJoined) {
    setCustomerEverJoined(true);
  }

  const [isRecording, setIsRecording] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);

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

  // Consent popover state
  const [showConsentPopover, setShowConsentPopover] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Chat tab state (Interviewer can switch between participant and backroom)
  const [chatTab, setChatTab] = useState<"participant" | "backroom">(
    "backroom",
  );

  // ─── Handlers ───────────────────────────────────────────────────────────

  const toggleCamera = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraOn);
    } catch (err) {
      console.error("[LiveSession] Camera toggle error:", err);
      toast.error("Failed to toggle camera");
    }
  }, [isCameraOn, localParticipant]);

  const toggleMic = useCallback(async () => {
    try {
      console.warn("[LiveSession] Toggling mic, current:", isMicOn);
      await localParticipant.setMicrophoneEnabled(!isMicOn);
    } catch (err) {
      console.error("[LiveSession] Mic toggle error:", err);
      toast.error("Failed to toggle microphone");
    }
  }, [isMicOn, localParticipant]);

  const toggleScreenShare = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isSharing);
    } catch (error: any) {
      if (error?.name === "NotAllowedError") return;
      toast.error("Failed to toggle screen share");
    }
  }, [isSharing, localParticipant]);

  const handleStartSession = useCallback(async () => {
    try {
      const { egressId: newEgressId } = await startLiveSessionRecording(
        session.id,
        session.study.teamId,
        session.studyId,
      );
      setIsRecording(true);
      setEgressId(newEgressId);
      // Record the moment recording began for timestamp alignment
      setLiveSessionRecordingStarted(session.id).catch(() => {});
      // Broadcast recording started to observers
      const strData = JSON.stringify({
        type: "RECORDING_STATE",
        isRecording: true,
      });
      await room.localParticipant.publishData(
        new TextEncoder().encode(strData),
        { reliable: true, topic: "session-control" },
      );
      toast.success("Session started");
    } catch {
      toast.error("Failed to start session");
    }
  }, [session.id, session.study.teamId, session.studyId, room]);

  const handleEndSession = useCallback(async () => {
    try {
      // Stop recording (best-effort — don't block session end if egress fails)
      if (egressId) {
        try {
          await stopLiveSessionRecording(egressId);
        } catch {
          logger.warn("Failed to stop egress during session end", { egressId });
        }
      }
      setIsRecording(false);
      setEgressId(null);
      // Broadcast recording stopped to observers
      const strData = JSON.stringify({
        type: "RECORDING_STATE",
        isRecording: false,
      });
      await room.localParticipant.publishData(
        new TextEncoder().encode(strData),
        { reliable: true, topic: "session-control" },
      );
      await updateLiveSessionStatus(session.id, "ENDED");
      toast.success("Session ended", {
        description: "Recording will be processed shortly.",
      });
    } catch {
      toast.error("Failed to end session");
    }
  }, [egressId, session.id, room]);

  const handleExit = useCallback(async () => {
    try {
      if (egressId) {
        await stopLiveSessionRecording(egressId);
      }
      // Broadcast session ended to all participants
      const endData = JSON.stringify({ type: "SESSION_ENDED" });
      await room.localParticipant
        .publishData(new TextEncoder().encode(endData), {
          reliable: true,
          topic: "session-control",
        })
        .catch(() => {});
      await updateLiveSessionStatus(session.id, "ENDED");
    } catch {
      // Best-effort cleanup
    }
    window.close();
  }, [egressId, session.id, room]);

  const handleToggleRecording = useCallback(async () => {
    try {
      if (isRecording && egressId) {
        await stopLiveSessionRecording(egressId);
        setIsRecording(false);
        setEgressId(null);
        const strData = JSON.stringify({
          type: "RECORDING_STATE",
          isRecording: false,
        });
        await room.localParticipant.publishData(
          new TextEncoder().encode(strData),
          { reliable: true, topic: "session-control" },
        );
        toast.success("Recording stopped", {
          description: "It will be processed shortly.",
        });
      } else {
        const { egressId: newEgressId } = await startLiveSessionRecording(
          session.id,
          session.study.teamId,
          session.studyId,
        );
        setIsRecording(true);
        setEgressId(newEgressId);
        const strData = JSON.stringify({
          type: "RECORDING_STATE",
          isRecording: true,
        });
        await room.localParticipant.publishData(
          new TextEncoder().encode(strData),
          { reliable: true, topic: "session-control" },
        );
        toast.success("Recording started");
      }
    } catch {
      toast.error("Failed to toggle recording");
    }
  }, [
    isRecording,
    egressId,
    session.id,
    session.study.teamId,
    session.studyId,
    room,
  ]);

  const switchDevice = useCallback(
    async (kind: "videoinput" | "audioinput", deviceId: string) => {
      try {
        await room.switchActiveDevice(kind, deviceId);
        toast.success(
          `${kind === "videoinput" ? "Camera" : "Microphone"} switched`,
        );
      } catch {
        toast.error("Failed to switch device");
      }
    },
    [room],
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full">
      {/* ── Main Stage (left) ─────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col">
        {/* Video area */}
        <div
          className="relative flex-1 cursor-pointer overflow-hidden bg-zinc-950"
          onClick={() => setShowToolbar((v) => !v)}
        >
          {/* Study name overlay */}
          <div className="absolute top-0 left-0 z-10 px-4 py-2">
            <span className="truncate text-sm font-semibold text-white/80 drop-shadow-md">
              {session.study?.name || "Live Session"}
              {session.name && (
                <span className="ml-2 font-normal text-white/60">
                  — {session.name}
                </span>
              )}
            </span>
          </div>

          {/* Floating banner when participant hasn't joined yet */}
          {!customerPresent && !customerEverJoined && (
            <div className="absolute top-12 left-1/2 z-20 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2 shadow-lg backdrop-blur">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                <span className="text-sm text-zinc-300">
                  Waiting for participant to join…
                </span>
              </div>
            </div>
          )}

          {tracks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-400">Setting up video…</p>
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
              {/* Notes textarea overlay */}
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

              {/* Tags row */}
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
                  Start recording to enable tags and notes
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* ── Bottom toolbar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between bg-zinc-950 px-3 py-2">
          {/* Left: media controls */}
          <div className="flex items-center gap-1.5">
            <ToolbarButton
              icon={
                isCameraOn ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )
              }
              label="Video"
              active={!isCameraOn}
              variant={isCameraOn ? "ghost" : "secondary"}
              onClick={toggleCamera}
              devices={videoDevices}
              onDeviceSelect={(id) => switchDevice("videoinput", id)}
            />
            <ToolbarButton
              icon={
                isMicOn ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )
              }
              label="Mic"
              active={!isMicOn}
              variant={isMicOn ? "ghost" : "secondary"}
              onClick={toggleMic}
              devices={audioDevices}
              onDeviceSelect={(id) => switchDevice("audioinput", id)}
            />
            <ToolbarButton
              icon={
                isSharing ? (
                  <MonitorOff className="h-5 w-5" />
                ) : (
                  <Monitor className="h-5 w-5" />
                )
              }
              label="Share"
              active={isSharing}
              variant={isSharing ? "secondary" : "ghost"}
              onClick={toggleScreenShare}
            />
            {!isRecording ? (
              <Popover
                open={showConsentPopover}
                onOpenChange={(open) => {
                  setShowConsentPopover(open);
                  if (!open) setConsentChecked(false);
                }}
              >
                <Tooltip
                  open={
                    !customerPresent && !customerEverJoined ? undefined : false
                  }
                >
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <div>
                        <ToolbarButton
                          icon={<Play className="h-5 w-5" />}
                          label="Start"
                          variant="ghost"
                          disabled={!customerPresent && !customerEverJoined}
                          onClick={() => setShowConsentPopover(true)}
                        />
                      </div>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="border-zinc-700 bg-zinc-900 text-zinc-100"
                  >
                    Waiting for participant to join
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="top"
                  align="center"
                  className="w-72 border-zinc-700 bg-zinc-900 p-4 text-zinc-100 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-medium text-zinc-100">
                    Before starting the session
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    This session will be recorded. Please confirm you have
                    consent.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <Checkbox
                      checked={consentChecked}
                      onCheckedChange={(v) => setConsentChecked(v === true)}
                      className="mt-0.5 border-zinc-600 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900"
                    />
                    <span className="text-xs leading-relaxed text-zinc-300">
                      I confirm the participant has given consent to be
                      recorded.
                    </span>
                  </label>
                  <Button
                    size="sm"
                    disabled={!consentChecked}
                    className="mt-3 w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:opacity-40"
                    onClick={() => {
                      setShowConsentPopover(false);
                      setConsentChecked(false);
                      handleStartSession();
                    }}
                  >
                    Start Session
                  </Button>
                </PopoverContent>
              </Popover>
            ) : (
              <ToolbarButton
                icon={<Square className="h-4 w-4" />}
                label="End"
                variant="destructive"
                onClick={handleEndSession}
              />
            )}
          </div>

          {/* Right: exit */}
          <ToolbarButton
            icon={<LogOut className="h-5 w-5" />}
            label="Exit"
            variant="ghost"
            onClick={handleExit}
          />
        </div>
      </div>

      {/* ── Chat Sidebar (right) ──────────────────────────────────────── */}
      <div className="hidden w-[328px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950 md:flex">
        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setChatTab("participant")}
            className={`flex-1 px-4 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors ${
              chatTab === "participant"
                ? "border-b-2 border-zinc-100 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Participant
          </button>
          <button
            type="button"
            onClick={() => setChatTab("backroom")}
            className={`flex-1 px-4 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors ${
              chatTab === "backroom"
                ? "border-b-2 border-zinc-100 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Backroom
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {chatTab === "participant" ? (
            <DirectChat />
          ) : (
            <BackroomChat sessionId={session.id} startTime={sessionStartTime} />
          )}
        </div>
      </div>
    </div>
  );
}
