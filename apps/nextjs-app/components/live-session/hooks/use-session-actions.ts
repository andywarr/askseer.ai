"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRoomContext } from "@livekit/components-react";
import { toast } from "sonner";
import {
  createLiveSessionTag,
  createLiveSessionNote,
  getLiveSessionScreenshotUploadUrl,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import type { ReactionTagType, LiveSessionData } from "../constants";

// ─── Screenshot capture helpers ─────────────────────────────────────────────

async function captureVideoFrame(): Promise<Blob | null> {
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

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });
}

async function uploadScreenshot(
  sessionId: string,
  teamId: string,
  studyId: string,
): Promise<string | null> {
  try {
    const blob = await captureVideoFrame();
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
    return null;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Shared state + handlers for reaction tags and timestamped notes.
 * Used by both InterviewerView and ObserverView.
 */
export function useSessionActions(session: LiveSessionData) {
  const room = useRoomContext();

  // Notes overlay state
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Tag feedback
  const [activeTag, setActiveTag] = useState<ReactionTagType | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);

  // Toolbar visibility
  const [showToolbar, setShowToolbar] = useState(true);

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

  return {
    // State
    showNotes,
    setShowNotes,
    noteText,
    noteInputRef,
    activeTag,
    noteSaved,
    showToolbar,
    setShowToolbar,
    localTags,
    localNotes,
    sessionStartTime,
    // Handlers
    handleTag,
    handleNoteSubmit,
    handleNoteKeyDown,
    handleNoteChange,
  };
}
