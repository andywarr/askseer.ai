"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  ParticipantTile,
  GridLayout,
  useTracks,
  useLocalParticipant,
  useRemoteParticipants,
  useDataChannel,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { logger } from "@/apps/shared/logger";
import { BackroomChat } from "./backroom-chat";
import { DirectChat } from "./direct-chat";
import { ObserverCount } from "./observer-count";

import {
  startLiveSessionRecording,
  stopLiveSessionRecording,
} from "@/apps/nextjs-app/lib/actions/livekit-actions";
import {
  updateLiveSessionStatus,
  createLiveSessionTag,
  createLiveSessionNote,
  getLiveSessionScreenshotUploadUrl,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  LogOut,
  Bug,
  Lightbulb,
  AlertTriangle,
  Zap,
  StickyNote,
  Check,
  Circle,
  Square,
  Play,
  ChevronUp,
  Loader2,
} from "lucide-react";

// ─── Tag types ──────────────────────────────────────────────────────────────

type ReactionTagType = "BUG" | "IDEA" | "PAIN_POINT" | "INSIGHT";

const TAG_CONFIG = [
  {
    type: "BUG" as ReactionTagType,
    label: "Bug",
    icon: Bug,
    color: "!text-red-500",
    bg: "hover:bg-red-500/20",
  },
  {
    type: "PAIN_POINT" as ReactionTagType,
    label: "Pain",
    icon: AlertTriangle,
    color: "!text-orange-500",
    bg: "hover:bg-orange-500/20",
  },
  {
    type: "IDEA" as ReactionTagType,
    label: "Idea",
    icon: Lightbulb,
    color: "!text-amber-500",
    bg: "hover:bg-amber-500/20",
  },
  {
    type: "INSIGHT" as ReactionTagType,
    label: "Insight",
    icon: Zap,
    color: "!text-purple-500",
    bg: "hover:bg-purple-500/20",
  },
];

// ─── Screenshot capture helpers ─────────────────────────────────────────────

/**
 * Captures the current frame of the first visible <video> element inside the
 * live-session video area. Returns a JPEG Blob or null if nothing is available.
 */
function captureVideoFrame(): Blob | null {
  // Grab the first <video> element with a real video stream in the page
  const videos = Array.from(
    document.querySelectorAll("video"),
  ) as HTMLVideoElement[];
  const video = videos.find((v) => v.readyState >= 2 && v.videoWidth > 0);
  if (!video) return null;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);

  // Synchronous: toBlob is async, but we can use toDataURL + manual conversion
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const byteString = atob(dataUrl.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: "image/jpeg" });
}

/**
 * Captures a screenshot and uploads it to S3 in the background.
 * Returns the S3 key on success, or null if capture/upload fails.
 */
async function uploadScreenshot(
  sessionId: string,
  teamId: string,
  studyId: string,
): Promise<string | null> {
  try {
    const blob = captureVideoFrame();
    if (!blob) return null;

    const fileName = `${Date.now()}.jpg`;
    const { uploadUrl, key } = await getLiveSessionScreenshotUploadUrl(
      sessionId,
      fileName,
      teamId,
      studyId,
    );

    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: blob,
    });

    return key;
  } catch {
    // Screenshot is best-effort — don't block the tag/note creation
    return null;
  }
}

// ─── Toolbar Button (square, icon on top, label underneath) ─────────────────

function ToolbarButton({
  icon,
  label,
  active = false,
  disabled = false,
  variant = "ghost",
  onClick,
  devices,
  onDeviceSelect,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  variant?: "ghost" | "secondary" | "destructive";
  onClick: () => void;
  devices?: MediaDeviceInfo[];
  onDeviceSelect?: (deviceId: string) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] transition-all active:scale-95 ${disabled ? "cursor-not-allowed opacity-40" : ""} ${
          variant === "destructive"
            ? "bg-red-500 text-white shadow-xs hover:bg-red-600 active:bg-red-700"
            : variant === "secondary" || active
              ? "bg-zinc-700 text-zinc-100 shadow-xs hover:bg-zinc-600 active:bg-zinc-500"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 active:bg-zinc-700"
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>

      {/* Device selector caret */}
      {devices && devices.length > 0 && onDeviceSelect && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            >
              <ChevronUp className="h-2.5 w-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="min-w-[200px]"
          >
            {devices.map((d) => (
              <DropdownMenuItem
                key={d.deviceId}
                onClick={() => onDeviceSelect(d.deviceId)}
              >
                <span className="truncate text-xs">
                  {d.label || `Device ${d.deviceId.slice(0, 8)}`}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ─── Hook: list available media devices ─────────────────────────────────────

function useMediaDevices() {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    async function enumerate() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
        setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
      } catch {
        // Permission not granted yet — devices will be empty
      }
    }
    enumerate();
    navigator.mediaDevices?.addEventListener("devicechange", enumerate);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", enumerate);
    };
  }, []);

  return { videoDevices, audioDevices };
}

interface LiveSessionRoomProps {
  token: string;
  wsUrl: string;
  role: "INTERVIEWER" | "CUSTOMER" | "OBSERVER";
  session: any;
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
      video={false}
      audio={false}
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
        if (
          msg.includes("could not connect") ||
          msg.includes("permission") ||
          msg.includes("token")
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

// ─── Customer View (Minimalist) ─────────────────────────────────────────────

function CustomerView({ session }: { session: any }) {
  const {
    localParticipant,
    isMicrophoneEnabled: isMicOn,
    isCameraEnabled: isCameraOn,
    isScreenShareEnabled: isSharing,
  } = useLocalParticipant();
  const { videoDevices, audioDevices } = useMediaDevices();
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  // Auto-enable mic + camera on mount (with graceful fallback for missing devices)
  const didAutoEnable = useRef(false);
  useEffect(() => {
    if (didAutoEnable.current) return;
    didAutoEnable.current = true;
    (async () => {
      try {
        await localParticipant.setCameraEnabled(true);
      } catch (err: any) {
        console.warn("[LiveSession] Camera auto-enable failed:", err?.message);
        if (err?.name === "NotFoundError") {
          toast.error("No camera found — check your device settings");
        }
      }
      try {
        await localParticipant.setMicrophoneEnabled(true);
      } catch (err: any) {
        console.warn("[LiveSession] Mic auto-enable failed:", err?.message);
        if (err?.name === "NotFoundError") {
          toast.error("No microphone found — check your device settings");
        }
      }
    })();
  }, [localParticipant]);

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
        await localParticipant.switchActiveDevice(kind, deviceId);
        toast.success(
          `${kind === "videoinput" ? "Camera" : "Microphone"} switched`,
        );
      } catch {
        toast.error("Failed to switch device");
      }
    },
    [localParticipant],
  );

  if (sessionEnded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-200">
              Thank you for participating!
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              The session has ended. You can close this window.
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

  return interviewerPresent ? (
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

// ─── Interviewer View (Wireframe layout) ────────────────────────────────────

function InterviewerView({ session }: { session: any }) {
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

  // Auto-enable mic + camera on mount (with graceful fallback for missing devices)
  const didAutoEnable = useRef(false);
  useEffect(() => {
    if (didAutoEnable.current) return;
    didAutoEnable.current = true;
    (async () => {
      try {
        await localParticipant.setCameraEnabled(true);
      } catch (err: any) {
        console.warn("[LiveSession] Camera auto-enable failed:", err?.message);
        if (err?.name === "NotFoundError") {
          toast.error("No camera found — check your device settings");
        }
      }
      try {
        await localParticipant.setMicrophoneEnabled(true);
      } catch (err: any) {
        console.warn("[LiveSession] Mic auto-enable failed:", err?.message);
        if (err?.name === "NotFoundError") {
          toast.error("No microphone found — check your device settings");
        }
      }
    })();
  }, [localParticipant]);

  const customerPresent = useMemo(
    () => remoteParticipants.some((p) => p.identity.startsWith("customer-")),
    [remoteParticipants],
  );

  // Track whether a customer has ever joined (so we don't show "waiting" after they leave)
  const customerEverJoined = useRef(false);
  if (customerPresent) customerEverJoined.current = true;

  const [isRecording, setIsRecording] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);

  // Notes overlay state
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Tag feedback
  const [activeTag, setActiveTag] = useState<ReactionTagType | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);

  // Toolbar visibility
  const [showToolbar, setShowToolbar] = useState(true);

  // Consent popover state
  const [showConsentPopover, setShowConsentPopover] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Chat tab state (Interviewer can switch between participant and backroom)
  const [chatTab, setChatTab] = useState<"participant" | "backroom">(
    "backroom",
  );

  // Local tags & notes (persisted via server actions)
  const [localTags, setLocalTags] = useState<
    { tagType: ReactionTagType; timestamp: number; createdAt: number }[]
  >([]);
  const [localNotes, setLocalNotes] = useState<
    { text: string; timestamp: number; createdAt: number }[]
  >([]);

  const sessionStartTime = useMemo(
    () =>
      session.startedAt
        ? new Date(session.startedAt).getTime()
        : new Date(session.createdAt).getTime(),
    [session.startedAt, session.createdAt],
  );

  // Focus notes input when opened or toolbar reappears
  useEffect(() => {
    if (showNotes && showToolbar && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [showNotes, showToolbar]);

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
      // Broadcast session ended to all participants
      const endData = JSON.stringify({ type: "SESSION_ENDED" });
      await room.localParticipant.publishData(
        new TextEncoder().encode(endData),
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
        await localParticipant.switchActiveDevice(kind, deviceId);
        toast.success(
          `${kind === "videoinput" ? "Camera" : "Microphone"} switched`,
        );
      } catch {
        toast.error("Failed to switch device");
      }
    },
    [localParticipant],
  );

  const handleTag = useCallback(
    async (tagType: ReactionTagType) => {
      try {
        const timestamp = (Date.now() - sessionStartTime) / 1000;
        setActiveTag(tagType);
        setTimeout(() => setActiveTag(null), 800);
        setLocalTags((prev) => [
          ...prev,
          { tagType, timestamp, createdAt: Date.now() },
        ]);
        const screenshotKey = await uploadScreenshot(
          session.id,
          session.study.teamId,
          session.studyId,
        );
        await createLiveSessionTag(
          session.id,
          tagType,
          timestamp,
          screenshotKey,
        );
        const strData = JSON.stringify({
          type: "REACTION_TAG",
          tagType,
          timestamp,
        });
        await room.localParticipant.publishData(
          new TextEncoder().encode(strData),
          { reliable: true },
        );
      } catch {
        toast.error("Failed to save tag");
      }
    },
    [session.id, session.study.teamId, session.studyId, sessionStartTime, room],
  );

  const handleNoteSubmit = useCallback(async () => {
    if (!noteText.trim()) return;
    try {
      const timestamp = (Date.now() - sessionStartTime) / 1000;
      const text = noteText.trim();
      setLocalNotes((prev) => [
        ...prev,
        { text, timestamp, createdAt: Date.now() },
      ]);
      const screenshotKey = await uploadScreenshot(
        session.id,
        session.study.teamId,
        session.studyId,
      );
      await createLiveSessionNote(session.id, text, timestamp, screenshotKey);
      const strData = JSON.stringify({ type: "SESSION_NOTE", text, timestamp });
      await room.localParticipant.publishData(
        new TextEncoder().encode(strData),
        {
          reliable: true,
          topic: "backroom",
        },
      );
      setNoteText("");
      setShowNotes(false);
    } catch {
      toast.error("Failed to save note");
    }
  }, [noteText, session.id, sessionStartTime, room]);

  const handleNoteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleNoteSubmit();
      } else if (e.key === "Escape") {
        setShowNotes(false);
        setNoteText("");
      }
    },
    [handleNoteSubmit],
  );

  // Auto-resize textarea
  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNoteText(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    },
    [],
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
          {!customerPresent && !customerEverJoined.current && (
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
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
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
                    !customerPresent && !customerEverJoined.current
                      ? undefined
                      : false
                  }
                >
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <div>
                        <ToolbarButton
                          icon={<Play className="h-5 w-5" />}
                          label="Start"
                          variant="ghost"
                          disabled={
                            !customerPresent && !customerEverJoined.current
                          }
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

// ─── Observer View (Backroom) ───────────────────────────────────────────────

function ObserverView({ session }: { session: any }) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  const interviewerPresent = useMemo(
    () => remoteParticipants.some((p) => p.identity.startsWith("interviewer-")),
    [remoteParticipants],
  );

  // Notes overlay state
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Tag feedback
  const [activeTag, setActiveTag] = useState<ReactionTagType | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);

  // Toolbar visibility
  const [showToolbar, setShowToolbar] = useState(true);

  // Recording state (received from interviewer via data channel)
  const [isRecording, setIsRecording] = useState(false);
  // Session ended signal (received from interviewer via data channel)
  const [sessionEnded, setSessionEnded] = useState(false);

  // Observer chat tab
  const [chatTab, setChatTab] = useState<"backroom">("backroom");

  // Local tags & notes (persisted via server actions)
  const [localTags, setLocalTags] = useState<
    { tagType: ReactionTagType; timestamp: number; createdAt: number }[]
  >([]);
  const [localNotes, setLocalNotes] = useState<
    { text: string; timestamp: number; createdAt: number }[]
  >([]);

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

  const sessionStartTime = useMemo(
    () =>
      session.startedAt
        ? new Date(session.startedAt).getTime()
        : new Date(session.createdAt).getTime(),
    [session.startedAt, session.createdAt],
  );

  useEffect(() => {
    if (showNotes && showToolbar && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [showNotes, showToolbar]);

  const handleTag = useCallback(
    async (tagType: ReactionTagType) => {
      try {
        const timestamp = (Date.now() - sessionStartTime) / 1000;
        setActiveTag(tagType);
        setTimeout(() => setActiveTag(null), 800);
        setLocalTags((prev) => [
          ...prev,
          { tagType, timestamp, createdAt: Date.now() },
        ]);
        const screenshotKey = await uploadScreenshot(
          session.id,
          session.study.teamId,
          session.studyId,
        );
        await createLiveSessionTag(
          session.id,
          tagType,
          timestamp,
          screenshotKey,
        );
        const strData = JSON.stringify({
          type: "REACTION_TAG",
          tagType,
          timestamp,
        });
        await room.localParticipant.publishData(
          new TextEncoder().encode(strData),
          { reliable: true },
        );
      } catch {
        toast.error("Failed to save tag");
      }
    },
    [session.id, session.study.teamId, session.studyId, sessionStartTime, room],
  );

  const handleNoteSubmit = useCallback(async () => {
    if (!noteText.trim()) return;
    try {
      const timestamp = (Date.now() - sessionStartTime) / 1000;
      const text = noteText.trim();
      setLocalNotes((prev) => [
        ...prev,
        { text, timestamp, createdAt: Date.now() },
      ]);
      const screenshotKey = await uploadScreenshot(
        session.id,
        session.study.teamId,
        session.studyId,
      );
      await createLiveSessionNote(session.id, text, timestamp, screenshotKey);
      const strData = JSON.stringify({ type: "SESSION_NOTE", text, timestamp });
      await room.localParticipant.publishData(
        new TextEncoder().encode(strData),
        {
          reliable: true,
          topic: "backroom",
        },
      );
      setNoteText("");
      setShowNotes(false);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 800);
    } catch {
      toast.error("Failed to save note");
    }
  }, [noteText, session.id, sessionStartTime, room]);

  const handleNoteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleNoteSubmit();
      } else if (e.key === "Escape") {
        setShowNotes(false);
        setNoteText("");
      }
    },
    [handleNoteSubmit],
  );

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNoteText(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    },
    [],
  );

  if (sessionEnded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <Check className="h-6 w-6 text-zinc-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-200">Session ended</p>
            <p className="mt-2 text-sm text-zinc-400">
              The interviewer has ended the session. You can close this window.
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

  return interviewerPresent ? (
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
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
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
