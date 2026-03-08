"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ParticipantTile,
  GridLayout,
  useTracks,
  useLocalParticipant,
  useRemoteParticipants,
  useDataChannel,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import { toast } from "sonner";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  LogOut,
  Loader2,
} from "lucide-react";
import { DirectChat } from "./direct-chat";
import { ToolbarButton, useMediaDevices } from "./toolbar";
import { useAutoEnableMedia } from "./hooks/use-auto-enable-media";
import type { LiveSessionData } from "./constants";

export function CustomerView({ session }: { session: LiveSessionData }) {
  const {
    localParticipant,
    isMicrophoneEnabled: isMicOn,
    isCameraEnabled: isCameraOn,
    isScreenShareEnabled: isSharing,
  } = useLocalParticipant();
  const room = useRoomContext();
  const { videoDevices, audioDevices } = useMediaDevices();
  const remoteParticipants = useRemoteParticipants();
  const allTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false },
  );

  // When others are present, hide self-view camera but keep screen shares
  const tracks = useMemo(
    () =>
      remoteParticipants.length > 0
        ? allTracks.filter(
            (t) =>
              t.participant.identity !== localParticipant.identity ||
              t.source === Track.Source.ScreenShare,
          )
        : allTracks,
    [allTracks, remoteParticipants.length, localParticipant.identity],
  );

  useAutoEnableMedia(localParticipant);

  const interviewerPresent = useMemo(
    () => remoteParticipants.some((p) => p.identity.startsWith("interviewer-")),
    [remoteParticipants],
  );

  // Recording state (received from interviewer via data channel)
  const [isRecording, setIsRecording] = useState(false);
  // Session ended signal (received from interviewer via data channel)
  const [sessionEnded, setSessionEnded] = useState(false);

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

  return interviewerPresent || sessionEnded ? (
    <div className="flex h-screen w-full">
      {/* ── Main Stage (left) ─────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col">
        {/* Video area */}
        <div className="relative flex-1 overflow-hidden bg-zinc-950">
          {/* Study name overlay */}
          <div className="absolute top-0 left-0 z-10 px-4 py-2">
            <span className="text-sm font-semibold text-white/80 drop-shadow-md">
              {session.study?.name || "Session"}
            </span>
          </div>
          {tracks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-400">Waiting for host…</p>
            </div>
          ) : (
            <GridLayout tracks={tracks}>
              <ParticipantTile />
            </GridLayout>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between bg-zinc-950 px-3 py-2">
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
          </div>
          <ToolbarButton
            icon={<LogOut className="h-5 w-5" />}
            label="Exit"
            variant="ghost"
            onClick={() => window.close()}
          />
        </div>
      </div>

      {/* ── Chat Sidebar (right) ──────────────────────────────────────── */}
      <div className="hidden w-[328px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950 md:flex">
        <div className="flex-1 overflow-hidden">
          <DirectChat />
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
            Your session will begin when the interviewer arrives
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
