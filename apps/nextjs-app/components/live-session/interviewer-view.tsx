"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Teleprompter, parseGuideItems } from "./teleprompter";
import { ObserverCount } from "./observer-count";
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
import { useTranslations } from "next-intl";

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
  UserX,
} from "lucide-react";
import { TAG_CONFIG, type LiveSessionData } from "./constants";
import { ToolbarButton, useMediaDevices } from "./toolbar";
import { useAutoEnableMedia } from "./hooks/use-auto-enable-media";
import { useSessionActions } from "./hooks/use-session-actions";

export function InterviewerView({ session }: { session: LiveSessionData }) {
  const t = useTranslations("LiveSessionRoom");
  const {
    localParticipant,
    isMicrophoneEnabled: isMicOn,
    isCameraEnabled: isCameraOn,
    isScreenShareEnabled: isSharing,
  } = useLocalParticipant();
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { videoDevices, audioDevices } = useMediaDevices();
  const allTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false },
  );

  // When others are present, hide self-view camera but keep screen shares.
  // Exclude observers — they never publish tracks and shouldn't affect the grid.
  const nonObserverRemotes = useMemo(
    () => remoteParticipants.filter((p) => !p.identity.startsWith("observer-")),
    [remoteParticipants],
  );

  const tracks = useMemo(
    () => {
      // Filter out observer tracks (they have none, but guard against edge cases)
      const filtered = allTracks.filter(
        (t) => !t.participant.identity.startsWith("observer-"),
      );
      return nonObserverRemotes.length > 0
        ? filtered.filter(
            (t) =>
              t.participant.identity !== localParticipant.identity ||
              t.source === Track.Source.ScreenShare,
          )
        : filtered;
    },
    [allTracks, nonObserverRemotes.length, localParticipant.identity],
  );

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

  // Teleprompter state
  const [teleprompterIndex, setTeleprompterIndex] = useState(0);
  // Track whether recording was ever started during this room visit
  // (survives handleEndSession clearing isRecording/egressId)
  const sessionEverStartedRef = useRef(false);

  // Revert LIVE → SCHEDULED if interviewer closes the tab without clicking Exit
  // and recording was never started.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (sessionEverStartedRef.current) return;
      // Fire-and-forget keepalive fetch — `sendBeacon` alternative that supports JSON
      fetch("/api/live-session/revert-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [session.id]);

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

  // Teleprompter index broadcast
  const handleTeleprompterIndexChange = useCallback(
    (newIndex: number) => {
      setTeleprompterIndex(newIndex);
      // Broadcast to observers
      const strData = JSON.stringify({
        type: "TELEPROMPTER_INDEX",
        index: newIndex,
      });
      room.localParticipant
        .publishData(new TextEncoder().encode(strData), {
          reliable: true,
          topic: "teleprompter",
        })
        .catch(() => {});
    },
    [room],
  );

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
      toast.error(t("failedToggleCamera"));
    }
  }, [isCameraOn, localParticipant, t]);

  const toggleMic = useCallback(async () => {
    try {
      console.warn("[LiveSession] Toggling mic, current:", isMicOn);
      await localParticipant.setMicrophoneEnabled(!isMicOn);
    } catch (err) {
      console.error("[LiveSession] Mic toggle error:", err);
      toast.error(t("failedToggleMicrophone"));
    }
  }, [isMicOn, localParticipant, t]);

  const toggleScreenShare = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isSharing);
    } catch (error: any) {
      if (error?.name === "NotAllowedError") return;
      toast.error(t("failedToggleScreenShare"));
    }
  }, [isSharing, localParticipant, t]);

  const handleStartSession = useCallback(async () => {
    try {
      const { egressId: newEgressId } = await startLiveSessionRecording(
        session.id,
        session.study.teamId,
        session.studyId,
      );
      setIsRecording(true);
      setEgressId(newEgressId);
      sessionEverStartedRef.current = true;
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
      toast.success(t("sessionStarted"));
    } catch {
      toast.error(t("failedStartSession"));
    }
  }, [session.id, session.study.teamId, session.studyId, room, t]);

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
      toast.success(t("sessionEndedToast"), {
        description: t("sessionEndedToastDesc"),
      });
    } catch {
      toast.error(t("failedEndSession"));
    }
  }, [egressId, session.id, room, t]);

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
      // If recording was never started in this visit, revert to SCHEDULED;
      // otherwise mark as ENDED
      await updateLiveSessionStatus(
        session.id,
        sessionEverStartedRef.current ? "ENDED" : "SCHEDULED",
      );
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
        toast.success(t("recordingStoppedToast"), {
          description: t("recordingStoppedToastDesc"),
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
        toast.success(t("recordingStartedToast"));
      }
    } catch {
      toast.error(t("failedToggleRecording"));
    }
  }, [
    isRecording,
    egressId,
    session.id,
    session.study.teamId,
    session.studyId,
    room,
    t,
  ]);

  const switchDevice = useCallback(
    async (kind: "videoinput" | "audioinput", deviceId: string) => {
      try {
        await room.switchActiveDevice(kind, deviceId);
        toast.success(
          t("deviceSwitched", {
            deviceType: t(kind === "videoinput" ? "camera" : "microphone"),
          }),
        );
      } catch {
        toast.error(t("failedSwitchDevice"));
      }
    },
    [room, t],
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
          <div className="absolute top-0 left-0 z-10 px-4 py-4">
            <span className="truncate text-sm font-semibold text-white/80 drop-shadow-md">
              {session.study?.name || "Live Session"}
              {session.name && (
                <span className="ml-2 font-normal text-white/60">
                  — {session.name}
                </span>
              )}
            </span>
          </div>

          {/* Observer count (top-right) */}
          <div className="absolute top-0 right-0 z-10 px-4 py-4">
            <ObserverCount />
          </div>

          {/* Floating banner when participant hasn't joined yet */}
          {!customerPresent && !customerEverJoined && (
            <div className="absolute top-12 left-1/2 z-20 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2 shadow-lg backdrop-blur">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                <span className="text-sm text-zinc-300">
                  {t("waitingForParticipantBanner")}
                </span>
              </div>
            </div>
          )}

          {/* Floating banner when participant has left */}
          {!customerPresent && customerEverJoined && (
            <div className="absolute top-12 left-1/2 z-20 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2 shadow-lg backdrop-blur">
                <UserX className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-sm text-zinc-300">
                  {t("participantLeft")}
                </span>
              </div>
            </div>
          )}

          {tracks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-400">{t("settingUpVideo")}</p>
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
              {/* Teleprompter overlay */}
              {session.discussionGuideText && (
                <Teleprompter
                  text={session.discussionGuideText}
                  visible={true}
                  currentIndex={teleprompterIndex}
                  onIndexChange={handleTeleprompterIndexChange}
                  role="INTERVIEWER"
                />
              )}

              {/* Notes textarea overlay */}
              {showNotes && (
                <Textarea
                  ref={noteInputRef}
                  value={noteText}
                  onChange={handleNoteChange}
                  onKeyDown={handleNoteKeyDown}
                  placeholder={t("typeNotePlaceholder")}
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
                            {t(`tags.${type === "PAIN_POINT" ? "PAIN" : type}` as any)}
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
                      {t("toolbar.notes")}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t("startRecordingTooltip")}
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
              label={t("toolbar.video")}
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
              label={t("toolbar.mic")}
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
              label={t("toolbar.share")}
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
                          label={t("toolbar.start")}
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
                    {t("waitingForParticipantTooltip")}
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="top"
                  align="center"
                  className="w-72 border-zinc-700 bg-zinc-900 p-4 text-zinc-100 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-medium text-zinc-100">
                    {t("consentPopoverTitle")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {t("consentPopoverDesc")}
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <Checkbox
                      checked={consentChecked}
                      onCheckedChange={(v) => setConsentChecked(v === true)}
                      className="mt-0.5 border-zinc-600 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900"
                    />
                    <span className="text-xs leading-relaxed text-zinc-300">
                      {t("consentCheckbox")}
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
                    {t("startSessionButton")}
                  </Button>
                </PopoverContent>
              </Popover>
            ) : (
              <ToolbarButton
                icon={<Square className="h-4 w-4" />}
                label={t("toolbar.end")}
                variant="destructive"
                onClick={handleEndSession}
              />
            )}
          </div>

          {/* Right: exit */}
          <ToolbarButton
            icon={<LogOut className="h-5 w-5" />}
            label={t("toolbar.exit")}
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
            {t("tabs.participant")}
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
            {t("tabs.backroom")}
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
