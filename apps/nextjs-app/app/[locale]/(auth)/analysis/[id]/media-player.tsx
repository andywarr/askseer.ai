"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface MediaPlayerProps {
  src: string;
  fileType: "AUDIO" | "VIDEO";
  fileName?: string;
  /** Called on every timeupdate with the current time in seconds */
  onTimeUpdate?: (currentTime: number) => void;
  /** Imperatively seek to this time (seconds). Changes trigger a seek. */
  seekTo?: number | null;
  className?: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MediaPlayer({
  src,
  fileType,
  fileName,
  onTimeUpdate,
  seekTo,
  className,
}: MediaPlayerProps) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const lastSeekRef = useRef<number | null>(null);

  // Handle external seek requests
  useEffect(() => {
    if (
      seekTo !== null &&
      seekTo !== undefined &&
      seekTo !== lastSeekRef.current &&
      mediaRef.current
    ) {
      mediaRef.current.currentTime = seekTo;
      lastSeekRef.current = seekTo;
      if (!isPlaying) {
        mediaRef.current.play().catch(() => {});
      }
    }
  }, [seekTo, isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    setCurrentTime(media.currentTime);
    onTimeUpdate?.(media.currentTime);
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    setDuration(media.duration);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleEnded = useCallback(() => setIsPlaying(false), []);

  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      media.play().catch(() => {});
    } else {
      media.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = !media.muted;
    setIsMuted(media.muted);
  }, []);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const media = mediaRef.current;
      if (!media) return;
      const time = Number(e.target.value);
      media.currentTime = time;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    },
    [onTimeUpdate],
  );

  const cyclePlaybackRate = useCallback(() => {
    const rates = [1, 1.25, 1.5, 1.75, 2, 0.75];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    if (mediaRef.current) {
      mediaRef.current.playbackRate = nextRate;
    }
    setPlaybackRate(nextRate);
  }, [playbackRate]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const MediaElement = fileType === "VIDEO" ? "video" : "audio";

  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3", className)}>
      {/* Native media element — visible for video, hidden for audio */}
      <MediaElement
        ref={mediaRef as any}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        className={fileType === "VIDEO" ? "w-full max-h-64 rounded-md bg-black" : "hidden"}
      />

      {/* Player controls */}
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700"
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" />
          ) : (
            <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
          )}
        </button>

        {/* Time */}
        <span className="w-[90px] shrink-0 text-xs tabular-nums text-zinc-500">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Seek bar */}
        <div className="relative flex-1">
          <div className="h-1.5 rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-zinc-600 transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        {/* Playback rate */}
        <button
          type="button"
          onClick={cyclePlaybackRate}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
        >
          {playbackRate}×
        </button>

        {/* Mute */}
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* File name */}
      {fileName && (
        <p className="truncate text-[11px] text-zinc-400">{fileName}</p>
      )}
    </div>
  );
}
