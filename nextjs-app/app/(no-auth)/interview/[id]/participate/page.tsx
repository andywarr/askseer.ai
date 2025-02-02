"use client";

// Lib function imports
import { getEphemeralToken } from "@/lib/action";

// React imports
import { useEffect, useRef, useState } from "react";

// UI component imports
import { Button } from "@/components/ui/button";

export default function Page() {
  // Audio references for remote assistant output
  const audioElement = useRef<HTMLAudioElement | null>(null);

  // Audio references for local microphone input
  const audioStreamRef = useRef<MediaStream | null>(null);

  // WebRTC references
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const [isActive, setIsActive] = useState(false);

  function configureDataChannel(dataChannel: RTCDataChannel) {
    // Send session update
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        input_audio_transcription: {
          model: "whisper-1",
        },
      },
    };
    dataChannel.send(JSON.stringify(sessionUpdate));
  }

  // Send a message to the model
  function sendClientEvent(message: any) {
    if (dataChannelRef.current) {
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannelRef.current.send(JSON.stringify(message));
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  function startInterview() {
    console.log("Starting the interview");
    console.log(isActive);

    const responseCreate = {
      type: "session.update",
      response: {
        instructions: `You are an AI moderator interviewing a participant for customer research. Here is some context on the study:
        Goal:
        <goal>
        Understand peoples' experiences and perceptions using AI for customer discovery and research.
        </goal>

        Interviewees:
        <interviewees>
        People working on product teams who have used AI for customer discovery and research, including designers, product managers, and UX Researchers.
        </interviewees>

        Questions:
        <questions>
        1. Tell me about you. Where do you work and what is your role?
        2. Can you share your experience with using AI in customer discovery and research, if any?
        3. What role do you think AI can play in customer discovery and research?
        4. How do you feel about the idea of replacing or supplementing human moderators with AI?
        5. What do you believe are the strengths of AI in moderating research sessions compared to humans?
        6. What limitations or weaknesses do you foresee in AI moderators?
        7. Are there specific tasks in moderating research that you think AI could excel at? Why?
        8. How would you define success for an AI moderator in a UX research session?
        9. What else you’d like to share about your thoughts on AI moderators?
        </questions>

        Instructions:
        1. Ask each of the interview questions above.
        2. Ask follow-up questions to clarify or expand on the interviewee's responses, if needed.
        3. At the end of the interview, summarize what you heard and ask the interviewee if they have any additional feedback.

        Start the interview now!
        `,
      },
    };
    dataChannelRef.current?.send(JSON.stringify(responseCreate));
  }

  async function startSession() {
    try {
      // Get ephemeral token for OpenAI Realtime API
      const EPHEMERAL_KEY = await getEphemeralToken();

      // Create a peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up to play remote audio from the model
      audioElement.current = document.createElement("audio");
      audioElement.current.autoplay = true;
      pc.ontrack = (e) => {
        if (audioElement.current) {
          audioElement.current.srcObject = e.streams[0];
        }
      };

      // Set up to play remote audio from the model
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      peerConnectionRef.current.addTrack(audioStreamRef.current.getTracks()[0]);

      // Data channel for transcripts
      const dataChannel = pc.createDataChannel("response");
      dataChannelRef.current = dataChannel;

      // Create offer & set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send SDP offer to OpenAI Realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      // Set remote description
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);

      setIsActive(true);

      //startInterview();
    } catch (error) {
      console.error("startSession error:", error);
      stopSession();
    }
  }

  function stopSession() {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    setIsActive(false);
  }

  function handleStartStopButtonClick() {
    if (isActive) {
      console.log("Stopping the session");
      stopSession();
    } else {
      console.log("Starting the session");
      startSession();
    }
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannelRef && dataChannelRef.current) {
      // Append new server events to the list
      dataChannelRef.current.addEventListener("message", (e) => {
        console.log("Received message:", JSON.parse(e.data));
      });

      // Set session active when the data channel is opened
      dataChannelRef.current.addEventListener("open", () => {
        setIsActive(true);
        if (dataChannelRef.current) {
          configureDataChannel(dataChannelRef.current);
          startInterview();
        }
      });

      // Set session active when the data channel encounters an error
      dataChannelRef.current.addEventListener("error", () => {
        console.error("Data channel error");
      });
    }
  }, [dataChannelRef.current]);

  return (
    <div>
      <Button onClick={handleStartStopButtonClick}>
        {isActive ? "Stop" : "Start"}
      </Button>
    </div>
  );
}
