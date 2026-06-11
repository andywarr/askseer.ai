"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { UniversalLanguageSelector } from "@/apps/nextjs-app/components/i18n/universal-language-selector";
import {
  createRealtimeSession,
  saveInterviewMessages,
  getInterviewProbes,
  updateInterviewSessionStatus,
  finalizeInterviewSession,
  getInterviewLivekitToken,
  getInterviewRecordingUploadUrl,
  pauseInterviewSession,
  resumeInterviewSession,
} from "@/apps/nextjs-app/lib/actions/interview-actions";
import {
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  Clock,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Send,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";

interface ParticipantRoomProps {
  session: any;
  token: string;
}

interface TranscriptMessage {
  speaker: "AI" | "PARTICIPANT";
  text: string;
  id: string;
}

const INTERVIEW_MAX_MINUTES = 60;
const WARNING_MINUTES = 55;
const AUTO_FINALIZE_MINUTES = 59;

export function InterviewParticipantRoom({
  session,
  token,
}: ParticipantRoomProps) {
  const t = useTranslations("LiveSession");
  const locale = useLocale();

  const [status, setStatus] = useState<
    "checking" | "waiting" | "connecting" | "live" | "ended" | "paused"
  >(
    session.status === "COMPLETED" || session.status === "INCOMPLETE"
      ? "ended"
      : session.status === "PAUSED"
        ? "paused"
        : session.status === "LIVE"
          ? "connecting"
          : "checking",
  );
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [browserSupported, setBrowserSupported] = useState<boolean | null>(
    null,
  );
  const [micPermission, setMicPermission] = useState<
    "checking" | "granted" | "denied"
  >("checking");
  const [textInput, setTextInput] = useState("");
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseEmail, setPauseEmail] = useState("");
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const probeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageBufferRef = useRef<TranscriptMessage[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef(false);
  const preDialogMutedRef = useRef(false);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate timer/flag for the end_interview tool call — not cleared by transcript deltas
  const endInterviewRequestedRef = useRef(false);
  const endInterviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // True once the participant has spoken since the last AI turn.
  // Gates probe injection so probes never fire before the participant answers.
  const participantHasSpokenRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isAiRespondingRef = useRef(false);
  const pendingProbesRef = useRef<string[]>([]);
  // Set to true only when the AI calls end_interview (natural completion).
  const completedNaturallyRef = useRef(false);
  // Set to true once handleEndInterview has started, to prevent double-finalization.
  const sessionEndedRef = useRef(false);
  // Set to true once the session goes live (WS connected and audio flowing).
  const sessionWentLiveRef = useRef(false);
  const connectingRef = useRef(false);

  // Permission & device check on mount
  useEffect(() => {
    if (status !== "checking") return;

    // Check browser support — deferred via queueMicrotask so this setState
    // is never synchronous within the effect body (avoids React Compiler warning).
    const supported = !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      window.WebSocket
    );
    queueMicrotask(() => {
      setBrowserSupported(supported);
      if (!supported) {
        setMicPermission("denied");
        return;
      }
      // Request mic permission
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          setMicPermission("granted");
        })
        .catch(() => {
          setMicPermission("denied");
        });
    });
  }, [status]);

  // Auto-start connection on mount if initialized to "connecting" (e.g. after language change/reload when session is already LIVE)
  useEffect(() => {
    if (status === "connecting" && !wsRef.current && !sessionEndedRef.current) {
      handleStartInterview();
    }
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    const autoEndTimer = autoEndTimerRef;
    const endInterviewTimer = endInterviewTimerRef;
    return () => {
      wsRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (probeTimerRef.current) clearInterval(probeTimerRef.current);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
      if (autoEndTimer.current) clearTimeout(autoEndTimer.current);
      if (endInterviewTimer.current) clearTimeout(endInterviewTimer.current);
    };
  }, []);

  // Mark session as INCOMPLETE when the participant closes the tab during an active session
  useEffect(() => {
    let beaconSent = false;
    const sendIncompleteBeacon = () => {
      if (beaconSent) return;
      if (sessionWentLiveRef.current && !sessionEndedRef.current) {
        beaconSent = true;
        navigator.sendBeacon(`/api/interview/${session.id}/incomplete`);
      }
    };

    // pagehide is more reliable than beforeunload for tab closes
    window.addEventListener("pagehide", sendIncompleteBeacon);
    window.addEventListener("beforeunload", sendIncompleteBeacon);
    return () => {
      window.removeEventListener("pagehide", sendIncompleteBeacon);
      window.removeEventListener("beforeunload", sendIncompleteBeacon);
    };
  }, [session.id]);

  const addMessage = useCallback((msg: TranscriptMessage) => {
    setTranscript((prev) => [...prev, msg]);
    messageBufferRef.current.push(msg);
  }, []);

  // Flush buffered messages to the database every 10s
  const startFlushTimer = useCallback(() => {
    flushTimerRef.current = setInterval(async () => {
      const buffer = messageBufferRef.current;
      if (buffer.length === 0) return;
      messageBufferRef.current = [];
      try {
        await saveInterviewMessages(
          session.id,
          buffer.map((m) => ({
            speaker: m.speaker,
            text: m.text,
          })),
        );
      } catch (e) {
        // Re-add to buffer on failure
        messageBufferRef.current = [...buffer, ...messageBufferRef.current];
      }
    }, 10000);
  }, [session.id]);

  // Poll for observer probes — kept as fallback for observers who submit a probe
  // while the participant is not speaking. The committed handler is the primary path.
  const startProbePoller = useCallback(() => {
    probeTimerRef.current = setInterval(async () => {
      // Intentionally a no-op poll — probe delivery now happens in the
      // input_audio_buffer.committed handler to avoid race conditions.
      // This interval is kept so the ref infrastructure stays consistent.
    }, 30000);
  }, []);

  // Stable ref to handleEndInterview so startTimer doesn't need it as a dependency
  const handleEndInterviewRef = useRef<(() => Promise<void>) | null>(null);

  // Timer — updates every second
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);

      const elapsedMin = Math.floor(elapsed / 60);

      if (elapsedMin >= WARNING_MINUTES && !showWarning) {
        setShowWarning(true);
        toast.warning(t("live.endingSoon"), {
          description: t("live.endingSoonDescription", { minutes: INTERVIEW_MAX_MINUTES - elapsedMin }),
        });
      }

      if (elapsedMin >= AUTO_FINALIZE_MINUTES) {
        handleEndInterviewRef.current?.();
      }
    }, 1000);
  }, [showWarning]);

  const handleStartInterview = async () => {
    if (connectingRef.current || wsRef.current || sessionEndedRef.current) return;
    connectingRef.current = true;
    setStatus("connecting");
    try {
      // 1. Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 2. Start client-side recording
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.start(1000); // Record in 1s chunks

      // 3. Get ephemeral token from server
      const rtResult = await createRealtimeSession(token, locale);
      if (!rtResult.success) {
        toast.error(t("toasts.failedStartSession"));
        setStatus("waiting");
        connectingRef.current = false;
        return;
      }

      // 4. Connect to OpenAI Realtime API via WebSocket with ephemeral auth
      const clientSecret = rtResult.data.clientSecret;
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${rtResult.data.model}`,
        ["realtime", `openai-insecure-api-key.${clientSecret}`],
      );

      // Set up audio playback context for AI responses
      const playbackCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = playbackCtx;
      let nextPlayTime = 0;
      // Track playing sources so we can stop them on interruption
      const activeSources = new Set<AudioBufferSourceNode>();

      ws.onopen = async () => {
        connectingRef.current = false;
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              type: "realtime",
              audio: {
                input: {
                  transcription: {
                    model: "gpt-realtime-whisper",
                  },
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.7,
                    prefix_padding_ms: 400,
                    silence_duration_ms: 1200,
                    create_response: false,
                  },
                },
              },
              tools: [
                {
                  type: "function",
                  name: "end_interview",
                  description:
                    "Call this function when the interview is complete and you have finished saying your farewell to the participant.",
                  parameters: { type: "object", properties: {}, required: [] },
                },
                {
                  type: "function",
                  name: "pause_interview",
                  description:
                    "Call this function when the participant asks to pause, take a break, or continue later. Acknowledge their request warmly before calling this function.",
                  parameters: { type: "object", properties: {}, required: [] },
                },
              ],
              tool_choice: "auto",
            },
          }),
        );

        // Mark session as LIVE
        await updateInterviewSessionStatus(session.id, "LIVE", locale);
        setStatus("live");
        sessionWentLiveRef.current = true;
        startTimer();
        startFlushTimer();
        startProbePoller();

        // Send greeting trigger
        const greetingText = session.status === "LIVE"
          ? t("live.continueGreeting")
          : t("live.startGreeting");
        ws.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: greetingText,
                },
              ],
            },
          }),
        );
        ws.send(JSON.stringify({ type: "response.create" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Surface server-side errors
          if (data.type === "error") {
            const msg: string = data.error?.message ?? "Unknown error";
            // Suppress benign cancellation errors — these happen when
            // response.cancel is sent defensively and there's no active response.
            const isBenignCancel =
              msg.toLowerCase().includes("no active response") ||
              msg.toLowerCase().includes("cancellation failed");
            if (!isBenignCancel) {
              toast.error(`${t("toasts.failedStartSession")}: ${msg}`);
            }
          }

          // Track AI responding state
          if (data.type === "response.created") {
            isAiRespondingRef.current = true;
            // Clear previous question immediately so the UI switches to the
            // speaking indicator before the first transcript delta arrives.
            setCurrentQuestion("");
            setIsAiSpeaking(true);
          }

          if (data.type === "response.done") {
            isAiRespondingRef.current = false;
            setIsAiSpeaking(false);
            // Reset so the participant must speak again before probes fire.
            participantHasSpokenRef.current = false;

            // If end_interview was called in this response, all audio chunks
            // are now queued but still playing. Wait for playback to drain
            // before closing the session.
            if (endInterviewRequestedRef.current) {
              endInterviewRequestedRef.current = false;
              endInterviewTimerRef.current = setTimeout(() => {
                handleEndInterview();
              }, 8000);
            }
          }

          // Handle AI text response — show as centered question
          if (
            data.type === "response.output_audio_transcript.done" &&
            data.transcript
          ) {
            const text = data.transcript;
            setCurrentQuestion(text);
            setIsAiSpeaking(false);
            addMessage({
              speaker: "AI",
              text,
              id: `ai-${Date.now()}-${Math.random()}`,
            });

            // autoEndTimerRef is set by the end_interview tool call handler below
          }

          // AI called end_interview — flag it; the timer is started in
          // response.done once all audio chunks are queued.
          if (
            data.type === "response.output_item.done" &&
            data.item?.type === "function_call" &&
            data.item?.name === "end_interview"
          ) {
            endInterviewRequestedRef.current = true;
            // The AI decided all questions were covered — mark as natural completion.
            completedNaturallyRef.current = true;
          }

          // AI called pause_interview — suspend audio and show pause dialog
          if (
            data.type === "response.output_item.done" &&
            data.item?.type === "function_call" &&
            data.item?.name === "pause_interview"
          ) {
            preDialogMutedRef.current = isMutedRef.current;
            isMutedRef.current = true;
            audioContextRef.current?.suspend();
            wsRef.current?.close();
            setShowPauseDialog(true);
          }

          // Streaming AI transcript — append each delta to the display
          if (
            data.type === "response.output_audio_transcript.delta" &&
            data.delta
          ) {
            setIsAiSpeaking(true);
            setCurrentQuestion((prev) => prev + data.delta);
          }

          // Handle participant transcript — save to conversation
          if (
            data.type ===
              "conversation.item.input_audio_transcription.completed" &&
            data.transcript
          ) {
            addMessage({
              speaker: "PARTICIPANT",
              text: data.transcript,
              id: `p-${Date.now()}-${Math.random()}`,
            });
          }

          // VAD committed participant audio — cancel any in-flight response
          // (whether auto-triggered or otherwise), inject pending observer probes,
          // then trigger a fresh response so the AI sees the probe.
          // The cancel is unconditional: if there's no active response the server
          // returns a benign error that we suppress in the error handler above.
          if (data.type === "input_audio_buffer.committed") {
            ws.send(JSON.stringify({ type: "response.cancel" }));
            getInterviewProbes(session.id)
              .then((result) => {
                if (result.success && result.data) {
                  for (const p of result.data as { text: string }[]) {
                    const text = `Observer instruction (follow this in your next response, do not tell the participant it came from an observer): ${p.text}`;
                    ws.send(
                      JSON.stringify({
                        type: "conversation.item.create",
                        item: {
                          type: "message",
                          role: "system",
                          content: [{ type: "input_text", text }],
                        },
                      }),
                    );
                  }
                }
                ws.send(JSON.stringify({ type: "response.create" }));
              })
              .catch(() => {
                ws.send(JSON.stringify({ type: "response.create" }));
              });
          }

          // Track when participant starts/stops speaking
          if (data.type === "input_audio_buffer.speech_started") {
            setIsSpeaking(true);
            participantHasSpokenRef.current = true;
            if (speakingTimeoutRef.current) {
              clearTimeout(speakingTimeoutRef.current);
            }
            // Interrupt any AI audio currently playing
            for (const src of activeSources) {
              try {
                src.stop();
              } catch {
                /* already stopped */
              }
            }
            activeSources.clear();
            nextPlayTime = 0;
            setIsAiSpeaking(false);
            // Cancel the server-side response so no more audio chunks arrive
            ws.send(JSON.stringify({ type: "response.cancel" }));
          }

          if (data.type === "input_audio_buffer.speech_stopped") {
            // Brief delay before hiding indicator
            speakingTimeoutRef.current = setTimeout(() => {
              setIsSpeaking(false);
            }, 500);
          }

          // Play AI audio
          if (data.type === "response.output_audio.delta" && data.delta) {
            try {
              const binaryStr = atob(data.delta);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768;
              }
              const buffer = playbackCtx.createBuffer(1, float32.length, 24000);
              buffer.copyToChannel(float32, 0);
              const source = playbackCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(playbackCtx.destination);
              activeSources.add(source);
              source.onended = () => activeSources.delete(source);
              const now = playbackCtx.currentTime;
              const startAt = Math.max(now, nextPlayTime);
              source.start(startAt);
              nextPlayTime = startAt + buffer.duration;
            } catch {
              // Skip malformed audio chunks
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        toast.error(t("toasts.connectionError"));
        setStatus("waiting");
        connectingRef.current = false;
      };

      ws.onclose = () => {
        connectingRef.current = false;
        if (status === "live") {
          toast.info(t("toasts.disconnected"));
        }
      };

      wsRef.current = ws;

      // 5. Stream mic audio to WebSocket
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN || isMutedRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(
            -32768,
            Math.min(32767, Math.floor(inputData[i] * 32767)),
          );
        }
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(pcm16.buffer)),
        );
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64,
          }),
        );
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (error) {
      toast.error(t("toasts.micAccessError"));
      setStatus("waiting");
      connectingRef.current = false;
    }
  };

  const handleEndInterview = async () => {
    // Keep the ref up to date so startTimer can call us without a stale closure
    handleEndInterviewRef.current = handleEndInterview;
    // Prevent double-finalization (e.g. timer fires while cleanup already running)
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);
    if (probeTimerRef.current) clearInterval(probeTimerRef.current);
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);

    // Cancel any in-progress AI response immediately
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "response.cancel" }));
    }

    // Flush remaining messages
    if (messageBufferRef.current.length > 0) {
      try {
        await saveInterviewMessages(
          session.id,
          messageBufferRef.current.map((m) => ({
            speaker: m.speaker,
            text: m.text,
          })),
        );
        messageBufferRef.current = [];
      } catch (e) {
        // Best effort
      }
    }

    // Close WebSocket
    wsRef.current?.close();

    // Stop audio playback
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }

    // Stop recording and collect the blob
    const recordingBlob = await new Promise<Blob | null>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(
          recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: "audio/webm" })
            : null,
        );
        return;
      }
      recorder.onstop = () => {
        const blob =
          recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: "audio/webm" })
            : null;
        resolve(blob);
      };
      recorder.stop();
    });
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());

    // Upload recording to S3 if we have one
    let recordingKey: string | undefined;
    if (recordingBlob && recordingBlob.size > 0) {
      try {
        const urlResult = await getInterviewRecordingUploadUrl(session.id);
        if (urlResult.success && urlResult.data) {
          await fetch(urlResult.data.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "audio/webm" },
            body: recordingBlob,
          });
          recordingKey = urlResult.data.key;
        }
      } catch (e) {
        // Best effort — session still finalizes without recording
      }
    }

    // Finalize session (with recording key if available)
    const isIncomplete = !completedNaturallyRef.current;
    await finalizeInterviewSession(session.id, recordingKey, isIncomplete);
    setStatus("ended");
    if (isIncomplete) {
      toast.info(t("ended.incompleteToast"));
    } else {
      toast.success(t("ended.completedToast"));
    }
  };

  const handlePauseInterview = async () => {
    if (!pauseEmail.trim() || !pauseEmail.includes("@")) return;
    setIsPausing(true);

    // Fully stop everything now that the user has confirmed
    if (timerRef.current) clearInterval(timerRef.current);
    if (probeTimerRef.current) clearInterval(probeTimerRef.current);
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    wsRef.current?.close();
    audioContextRef.current?.close().catch(() => {});
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.stop();

    // Flush remaining messages
    if (messageBufferRef.current.length > 0) {
      try {
        await saveInterviewMessages(
          session.id,
          messageBufferRef.current.map((m) => ({
            speaker: m.speaker,
            text: m.text,
          })),
        );
        messageBufferRef.current = [];
      } catch {
        // Best effort
      }
    }

    // Prevent tab-close beacon from marking INCOMPLETE before the pause API call completes
    sessionEndedRef.current = true;

    // Pause the session
    const result = await pauseInterviewSession(session.id, pauseEmail.trim());
    if (result.success) {
      setShowPauseDialog(false);
      setStatus("paused");
      toast.success(t("toasts.pausedSuccess"));
    } else {
      // Pause failed — allow the beacon to fire again if tab is closed
      sessionEndedRef.current = false;
      toast.error(t("toasts.failedPause"));
      setIsPausing(false);
    }
  };

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const track = mediaStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = isMuted;
        setIsMuted(!isMuted);
        isMutedRef.current = !isMuted;
      }
    }
  };

  const handleSendText = () => {
    const text = textInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      return;

    // Cancel any in-progress or server-VAD-triggered response so our text
    // item is included in the next response rather than being ignored.
    wsRef.current.send(JSON.stringify({ type: "response.cancel" }));

    // Send as a text message to the AI
    wsRef.current.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text,
            },
          ],
        },
      }),
    );
    wsRef.current.send(JSON.stringify({ type: "response.create" }));

    // Save to transcript
    addMessage({
      speaker: "PARTICIPANT",
      text,
      id: `pt-${Date.now()}`,
    });

    setTextInput("");
    inputRef.current?.focus();
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (status === "ended") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30">
            <MessageSquare className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold">{t("ended.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("ended.description")}
          </p>
        </div>
      </div>
    );
  }

  if (status === "paused") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-900/30">
            <Pause className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold">{t("paused.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("paused.description")}
          </p>
          <Button
            size="lg"
            className="mt-6 gap-2"
            disabled={isResuming}
            onClick={async () => {
              setIsResuming(true);
              const result = await resumeInterviewSession(session.id);
              if (result.success) {
                setStatus("checking");
              } else {
                toast.error(t("toasts.failedResume"));
                setIsResuming(false);
              }
            }}
          >
            {isResuming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            {t("paused.continue")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header bar with branding & switcher */}
      <header className="flex items-center justify-between border-b border-zinc-900/40 bg-zinc-950/20 px-6 py-3.5 backdrop-blur-md animate-in fade-in slide-in-from-top duration-500">
        <div className="flex items-center gap-2">
          <Image src="/logo-white.png" alt="Seer Logo" width={18} height={18} />
          <span className="text-sm font-semibold tracking-tight">Seer</span>
        </div>
        <UniversalLanguageSelector
          triggerVariant="ghost"
          triggerSize="sm"
          className="h-8 border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm text-xs text-zinc-300 hover:bg-zinc-900/80 hover:text-zinc-100 transition-colors animate-in fade-in"
          onBeforeChange={() => {
            // Prevent the beforeunload/pagehide beacon from marking the session as INCOMPLETE
            sessionEndedRef.current = true;

            // Stop all media and WebSocket connections immediately
            if (wsRef.current) {
              try {
                wsRef.current.send(JSON.stringify({ type: "response.cancel" }));
              } catch (e) {}
              wsRef.current.close();
              wsRef.current = null;
            }
            if (audioContextRef.current) {
              audioContextRef.current.close().catch(() => {});
              audioContextRef.current = null;
            }
            if (mediaStreamRef.current) {
              mediaStreamRef.current.getTracks().forEach((t) => t.stop());
              mediaStreamRef.current = null;
            }
            if (mediaRecorderRef.current) {
              try {
                mediaRecorderRef.current.stop();
              } catch (e) {}
              mediaRecorderRef.current = null;
            }

            // Set status to "connecting" so the UI immediately shows the loader
            setStatus("connecting");
          }}
        />
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {status === "checking" && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <h1 className="text-3xl font-bold">{t("deviceCheck.title")}</h1>
              <p className="text-muted-foreground mt-2 max-w-md">
                {t("deviceCheck.description")}
              </p>
            </div>

            <div className="w-full max-w-sm divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 text-left">
              {/* Browser support */}
              <div className="flex items-center gap-3 px-4 py-3">
                {browserSupported === null ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                ) : browserSupported ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <span className="text-sm">
                  {browserSupported === null
                    ? t("deviceCheck.checkingBrowser")
                    : browserSupported
                      ? t("deviceCheck.browserSupported")
                      : t("deviceCheck.browserNotSupported")}
                </span>
              </div>

              {/* Microphone */}
              <div className="flex items-center gap-3 px-4 py-3">
                {micPermission === "checking" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                ) : micPermission === "granted" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <span className="text-sm">
                  {micPermission === "checking"
                    ? t("deviceCheck.requestingMic")
                    : micPermission === "granted"
                      ? t("deviceCheck.micGranted")
                      : t("deviceCheck.micDenied")}
                </span>
              </div>
            </div>

            {micPermission === "denied" && (
              <p className="max-w-sm text-sm text-red-400">
                {t("deviceCheck.micInstruction")}
              </p>
            )}

            <Button
              size="lg"
              className="mt-2 gap-2"
              disabled={micPermission !== "granted" || !browserSupported}
              onClick={() => setStatus("waiting")}
            >
              <CheckCircle2 className="h-5 w-5" />
              {t("deviceCheck.continue")}
            </Button>
          </div>
        )}

        {status === "waiting" && (
          <div className="text-center">
            <h1 className="text-3xl font-bold">{t("ready.title")}</h1>
            <p className="text-muted-foreground mt-2 max-w-md">
              {t("ready.description")}
            </p>
            <Button
              size="lg"
              className="mt-6 gap-2"
              onClick={handleStartInterview}
            >
              <MessageSquare className="h-5 w-5" />
              {t("ready.start")}
            </Button>
          </div>
        )}

        {status === "connecting" && (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-400" />
            <p className="text-muted-foreground mt-4">
              {t("connecting.text")}
            </p>
          </div>
        )}

        {status === "live" && (
          <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-between gap-6">
            {/* Top: Timer + status */}
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-zinc-400" />
                <span
                  className={
                    Math.floor(elapsedSeconds / 60) >= WARNING_MINUTES
                      ? "text-amber-400"
                      : "text-zinc-400"
                  }
                >
                  {formatTime(elapsedSeconds)} / {INTERVIEW_MAX_MINUTES}:00
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="text-xs text-green-400">{t("live.badge")}</span>
              </div>
            </div>

            {showWarning && (
              <div className="flex w-full items-center gap-2 rounded-lg border border-amber-800 bg-amber-900/20 px-4 py-2 text-sm text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t("live.endingSoonBanner", { minutes: INTERVIEW_MAX_MINUTES - Math.floor(elapsedSeconds / 60) })}
              </div>
            )}

            {/* Center: Current question — large, centered */}
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              {currentQuestion ? (
                <p className="text-xl leading-relaxed font-medium md:text-2xl">
                  {currentQuestion}
                  {isAiSpeaking && (
                    <span className="ml-1 inline-block h-5 w-1 animate-pulse rounded bg-violet-400" />
                  )}
                </p>
              ) : isAiSpeaking ? (
                // Response started but transcript hasn't arrived yet — show
                // a speaking indicator so there's no flash of the spinner.
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-[bounce_0.8s_ease-in-out_infinite] rounded-full bg-violet-400" />
                  <span className="h-2 w-2 animate-[bounce_0.8s_ease-in-out_infinite_0.15s] rounded-full bg-violet-400" />
                  <span className="h-2 w-2 animate-[bounce_0.8s_ease-in-out_infinite_0.3s] rounded-full bg-violet-400" />
                </div>
              ) : (
                !isSpeaking && (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                    <p className="text-sm text-zinc-500">
                      {t("live.preparing")}
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Bottom: Speaking indicator + Text input + controls */}
            <div className="flex w-full flex-col gap-3">
              {/* Speaking indicator — fixed above input */}
              <div className="flex h-8 items-center justify-center">
                {isSpeaking && !isMuted && (
                  <div className="flex items-center gap-2 rounded-full bg-violet-900/30 px-4 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="h-3 w-1 animate-[pulse_0.5s_ease-in-out_infinite] rounded-full bg-violet-400" />
                      <span className="h-4 w-1 animate-[pulse_0.5s_ease-in-out_infinite_0.15s] rounded-full bg-violet-400" />
                      <span className="h-2 w-1 animate-[pulse_0.5s_ease-in-out_infinite_0.3s] rounded-full bg-violet-400" />
                      <span className="h-5 w-1 animate-[pulse_0.5s_ease-in-out_infinite_0.1s] rounded-full bg-violet-400" />
                      <span className="h-3 w-1 animate-[pulse_0.5s_ease-in-out_infinite_0.25s] rounded-full bg-violet-400" />
                    </div>
                    <span className="text-xs text-violet-300">
                      {t("live.listening")}
                    </span>
                  </div>
                )}
              </div>

              {/* Text input */}
              <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                  placeholder={t("live.placeholder")}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleSendText}
                  disabled={!textInput.trim()}
                  className="rounded p-1 text-zinc-400 transition-colors hover:text-violet-400 disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5 text-red-400" />
                  ) : (
                    <Mic className="h-5 w-5 text-green-400" />
                  )}
                  {isMuted ? t("live.unmute") : t("live.mute")}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={() => {
                    // Suspend audio immediately so it can be resumed if cancelled
                    preDialogMutedRef.current = isMutedRef.current;
                    isMutedRef.current = true;
                    audioContextRef.current?.suspend();
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(
                        JSON.stringify({ type: "response.cancel" }),
                      );
                    }
                    setShowPauseDialog(true);
                  }}
                >
                  <Pause className="h-5 w-5 text-amber-400" />
                  {t("live.pause")}
                </Button>

                <Button
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                  onClick={handleEndInterview}
                >
                  <PhoneOff className="h-5 w-5" />
                  {t("live.end")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Pause dialog */}
      <Dialog
        open={showPauseDialog}
        onOpenChange={(open) => {
          if (!open && !isPausing) {
            // Restore audio when dialog is dismissed without confirming
            isMutedRef.current = preDialogMutedRef.current;
            audioContextRef.current?.resume();
          }
          setShowPauseDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pauseDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("pauseDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="email"
              placeholder={t("pauseDialog.emailPlaceholder")}
              value={pauseEmail}
              onChange={(e) => setPauseEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePauseInterview();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                isMutedRef.current = preDialogMutedRef.current;
                audioContextRef.current?.resume();
                setShowPauseDialog(false);
              }}
              disabled={isPausing}
            >
              {t("pauseDialog.cancel")}
            </Button>
            <Button
              onClick={handlePauseInterview}
              disabled={
                isPausing || !pauseEmail.trim() || !pauseEmail.includes("@")
              }
            >
              {isPausing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("pauseDialog.pauseButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="pt-2 pb-4 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          {t("footer.poweredBy")}
          <Image src="/logo-white.png" alt="Seer" width={16} height={16} />
        </span>
      </footer>
    </div>
  );
}
