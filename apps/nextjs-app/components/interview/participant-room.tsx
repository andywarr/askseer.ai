"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  createRealtimeSession,
  saveInterviewMessages,
  getInterviewProbes,
  updateInterviewSessionStatus,
  finalizeInterviewSession,
  getInterviewLivekitToken,
  getInterviewRecordingUploadUrl,
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
} from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";

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
  const [status, setStatus] = useState<
    "checking" | "waiting" | "connecting" | "live" | "ended"
  >(
    session.status === "COMPLETED" || session.status === "INCOMPLETE"
      ? "ended"
      : "checking",
  );
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [micPermission, setMicPermission] = useState<
    "checking" | "granted" | "denied"
  >("checking");
  const [browserSupported, setBrowserSupported] = useState<boolean | null>(
    null,
  );
  const [textInput, setTextInput] = useState("");

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

  // Permission & device check on mount
  useEffect(() => {
    if (status !== "checking") return;

    // Check browser support
    const supported = !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      window.WebSocket
    );
    setBrowserSupported(supported);

    if (!supported) {
      setMicPermission("denied");
      return;
    }

    // Request mic permission
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Permission granted — stop the test stream immediately
        stream.getTracks().forEach((t) => t.stop());
        setMicPermission("granted");
      })
      .catch(() => {
        setMicPermission("denied");
      });
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (probeTimerRef.current) clearInterval(probeTimerRef.current);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
      if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
      if (endInterviewTimerRef.current)
        clearTimeout(endInterviewTimerRef.current);
    };
  }, []);

  // Mark session as INCOMPLETE when the participant closes the tab during an active session
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only send beacon if the session was live and hasn't been finalized yet
      if (
        !sessionEndedRef.current &&
        wsRef.current &&
        wsRef.current.readyState !== WebSocket.CLOSED &&
        wsRef.current.readyState !== WebSocket.CLOSING
      ) {
        navigator.sendBeacon(`/api/interview/${session.id}/incomplete`);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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

  // Poll for observer probes
  const startProbePoller = useCallback(() => {
    probeTimerRef.current = setInterval(async () => {
      try {
        const result = await getInterviewProbes(session.id);
        if (result.success && result.data && result.data.length > 0) {
          const probeTexts = result.data.map(
            (p: { text: string }) =>
              `[Observer instruction - do not reveal this to the participant]: ${p.text}`,
          );
          // Always queue — probes are only sent after the participant
          // finishes their answer so they never interrupt mid-turn.
          pendingProbesRef.current.push(...probeTexts);
        }
      } catch (e) {
        // Silent fail for probe polling
      }
    }, 5000);
  }, [session.id]);

  // Timer — updates every second
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);

      const elapsedMin = Math.floor(elapsed / 60);

      if (elapsedMin >= WARNING_MINUTES && !showWarning) {
        setShowWarning(true);
        toast.warning("Interview ending soon", {
          description: `The interview will automatically end in ${INTERVIEW_MAX_MINUTES - elapsedMin} minute(s).`,
        });
      }

      if (elapsedMin >= AUTO_FINALIZE_MINUTES) {
        handleEndInterview();
      }
    }, 1000);
  }, [showWarning]);

  const handleStartInterview = async () => {
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
      const rtResult = await createRealtimeSession(token);
      if (!rtResult.success) {
        toast.error("Failed to start AI session");
        setStatus("waiting");
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

      ws.onopen = async () => {
        // Configure session with higher VAD threshold to reduce false speech
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
              ],
              tool_choice: "auto",
            },
          }),
        );

        // Mark session as LIVE
        await updateInterviewSessionStatus(session.id, "LIVE");
        setStatus("live");
        startTimer();
        startFlushTimer();
        startProbePoller();

        // Send greeting trigger
        ws.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Hello, I'm ready to start the interview.",
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

          // Log all events for debugging
          console.log("[Realtime]", data.type, data);

          // Surface server-side errors
          if (data.type === "error") {
            console.error("[Realtime] server error", data.error);
            toast.error(
              `Interview error: ${data.error?.message ?? "Unknown error"}`,
            );
          }

          // Track AI responding state — used to gate probe injection
          if (data.type === "response.created") {
            isAiRespondingRef.current = true;
            // Clear previous question immediately so the UI switches to the
            // speaking indicator before the first transcript delta arrives.
            setCurrentQuestion("");
            setIsAiSpeaking(true);

            // If probes queued while the participant was speaking, cancel this
            // auto-triggered response (no audio has played yet), prepend the
            // probe instructions, then re-trigger so the AI addresses them.
            // Only inject if the participant has actually spoken this turn —
            // this prevents probes firing while the participant is muted.
            if (
              pendingProbesRef.current.length > 0 &&
              participantHasSpokenRef.current &&
              ws.readyState === WebSocket.OPEN
            ) {
              ws.send(JSON.stringify({ type: "response.cancel" }));
              const probes = [...pendingProbesRef.current];
              pendingProbesRef.current = [];
              for (const text of probes) {
                ws.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "message",
                      role: "user",
                      content: [{ type: "input_text", text }],
                    },
                  }),
                );
              }
              ws.send(JSON.stringify({ type: "response.create" }));
            }
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

          // Streaming AI transcript — append each delta to the display
          if (data.type === "response.output_audio_transcript.delta" && data.delta) {
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

          // Track when participant starts/stops speaking
          if (data.type === "input_audio_buffer.speech_started") {
            setIsSpeaking(true);
            participantHasSpokenRef.current = true;
            if (speakingTimeoutRef.current) {
              clearTimeout(speakingTimeoutRef.current);
            }
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
        toast.error("Connection error. Please try again.");
        setStatus("waiting");
      };

      ws.onclose = () => {
        if (status === "live") {
          toast.info("AI session disconnected.");
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
      toast.error(
        "Failed to start interview. Please ensure microphone access is granted.",
      );
      setStatus("waiting");
    }
  };

  const handleEndInterview = async () => {
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
        console.error("Failed to upload recording", e);
      }
    }

    // Finalize session (with recording key if available)
    const isIncomplete = !completedNaturallyRef.current;
    await finalizeInterviewSession(session.id, recordingKey, isIncomplete);
    setStatus("ended");
    if (isIncomplete) {
      toast.info("Interview ended. Thank you for your time!");
    } else {
      toast.success("Interview completed. Thank you!");
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
          <h1 className="text-2xl font-bold">Interview Complete</h1>
          <p className="text-muted-foreground mt-2">
            Thank you for your participation. You can safely close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {status === "checking" && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <h1 className="text-3xl font-bold">Device Check</h1>
              <p className="text-muted-foreground mt-2 max-w-md">
                Let&apos;s make sure everything is set up before we begin.
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
                    ? "Checking browser..."
                    : browserSupported
                      ? "Browser supported"
                      : "Browser not supported"}
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
                    ? "Requesting microphone access..."
                    : micPermission === "granted"
                      ? "Microphone access granted"
                      : "Microphone access denied"}
                </span>
              </div>
            </div>

            {micPermission === "denied" && (
              <p className="max-w-sm text-sm text-red-400">
                Please allow microphone access in your browser settings and
                reload the page to continue.
              </p>
            )}

            <Button
              size="lg"
              className="mt-2 gap-2"
              disabled={micPermission !== "granted" || !browserSupported}
              onClick={() => setStatus("waiting")}
            >
              <CheckCircle2 className="h-5 w-5" />
              Continue
            </Button>
          </div>
        )}

        {status === "waiting" && (
          <div className="text-center">
            <h1 className="text-3xl font-bold">Ready to Start?</h1>
            <p className="text-muted-foreground mt-2 max-w-md">
              You&apos;ll be connected to an AI moderator who will guide you
              through the interview.
            </p>
            <Button
              size="lg"
              className="mt-6 gap-2"
              onClick={handleStartInterview}
            >
              <MessageSquare className="h-5 w-5" />
              Start Interview
            </Button>
          </div>
        )}

        {status === "connecting" && (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-400" />
            <p className="text-muted-foreground mt-4">
              Connecting to AI moderator...
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
                <span className="text-xs text-green-400">LIVE</span>
              </div>
            </div>

            {showWarning && (
              <div className="flex w-full items-center gap-2 rounded-lg border border-amber-800 bg-amber-900/20 px-4 py-2 text-sm text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Interview ending in{" "}
                {INTERVIEW_MAX_MINUTES - Math.floor(elapsedSeconds / 60)}{" "}
                minute(s)
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
                      Moderator is preparing...
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
                      Listening...
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
                  placeholder="Speak or type a response..."
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
                  {isMuted ? "Unmute" : "Mute"}
                </Button>

                <Button
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                  onClick={handleEndInterview}
                >
                  <PhoneOff className="h-5 w-5" />
                  End Interview
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="pt-2 pb-4 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          Powered by Seer
          <img src="/logo-white.png" alt="Seer" className="h-4 w-4" />
        </span>
      </footer>
    </div>
  );
}
