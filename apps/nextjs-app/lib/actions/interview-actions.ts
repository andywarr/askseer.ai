"use server";

import { logger } from "@/apps/shared/logger";
import {
  PERSONAL_INTERVIEW_COST_CENTS,
  COMPANY_INTERVIEW_COST_CENTS,
} from "@/apps/shared/constants";
import {
  requireAuth,
  actionSuccess,
  actionError,
  ActionResult,
  generateRandomFileName,
} from "@/apps/nextjs-app/lib/actions/shared";
import { generatePresignedPutUrl } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { getTeam, addTeamBalance } from "@/apps/nextjs-app/lib/db/data";

// ============================================================================
// Interview Session Management
// ============================================================================

/**
 * Create a new interview session for the given interview.
 * Returns participant and observer links.
 */
export async function createInterviewSession(
  interviewId: string,
): Promise<ActionResult<{ participantLink: string; observerLink: string }>> {
  const user = await requireAuth();

  try {
    // Balance check: verify team can afford one session
    if (!user.selectedTeamId) {
      return actionError("Please select a team before creating sessions.");
    }
    const team = await getTeam(user.selectedTeamId);
    const perSessionCost = team?.companyId
      ? COMPANY_INTERVIEW_COST_CENTS
      : PERSONAL_INTERVIEW_COST_CENTS;

    if (!team || (team?.balanceCents ?? 0) < perSessionCost) {
      return actionError(
        `Insufficient funds. Creating a session costs $${(perSessionCost / 100).toFixed(2)}.`,
      );
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/init`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return actionError(body.message || "Failed to create interview session");
    }

    const { data } = await res.json();

    // Charge for the session
    await addTeamBalance({
      teamId: user.selectedTeamId,
      amountCents: -perSessionCost,
      byUserId: user.id,
      reason: "consume_interview_session",
    });

    return actionSuccess({
      participantLink: data.participantLink,
      observerLink: data.observerLink,
    });
  } catch (error) {
    logger.error("Failed to create interview session", {
      interviewId,
      userId: user.id,
      error,
    });
    return actionError("Failed to create interview session");
  }
}

/**
 * Create an OpenAI Realtime API ephemeral session token.
 * Runs server-side so the OpenAI API key never reaches the client.
 */
export async function createRealtimeSession(
  sessionId: string,
): Promise<ActionResult<{ clientSecret: string; systemPrompt: string }>> {
  try {
    // First, get the interview session data to find the system prompt
    const sessionRes = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/token?token=${sessionId}`,
      { cache: "no-store" },
    );

    if (!sessionRes.ok) {
      return actionError("Interview session not found");
    }

    const { data: sessionData } = await sessionRes.json();
    const systemPrompt =
      sessionData?.session?.interview?.systemPrompt ||
      `You are a skilled UX research moderator conducting a one-on-one interview. Follow these principles drawn from professional interviewing methodology:

OPENING (MANDATORY — follow this sequence exactly):

Step 1 — Introduction & overview:
Your very first message must warmly welcome the participant and give a clear overview of the session. Cover all of the following in a natural, conversational way (do NOT use bullet points or numbered lists when speaking):
- Thank them for taking the time to participate.
- Briefly explain what the interview is about and roughly how long it will take (e.g., "about 30 minutes" or whatever the actual duration is).
- Reassure them that there are no right or wrong answers — you are here to learn from their real experiences, not to test them.
- Let them know their responses will be kept confidential and used only to improve the product/experience.
- Tell them they can stop or take a break at any time.
End this message by asking for their permission to record the session.

Step 2 — Consent:
- Wait for the participant to respond to the recording request.
- If they give consent (e.g., "yes", "sure", "okay", "that's fine", "go ahead"), thank them briefly and move on to the first interview question.
- If they decline consent (e.g., "no", "I'd rather not", "I don't want to be recorded", or any refusal), you MUST respond with: "I completely understand, and I appreciate you considering participating in this study. Thank you for your time, and have a great day." Then do NOT ask any further questions — the session is over.
- Do NOT proceed with the interview if consent is not given. Do NOT try to persuade them.

CORE APPROACH:
- Ask one question at a time. Keep questions short and clear.
- Use open-ended questions that begin with "how", "what", "tell me about", or "describe".
- Never ask leading questions or suggest answers.
- Ask for specific, concrete examples: "Can you tell me about a specific time when…?" or "Walk me through the last time you…"
- Focus on past behavior and real experiences, not hypotheticals or opinions about the future.

PROBING & FOLLOW-UP:
- When a participant gives a vague answer, probe deeper: "Tell me more about that", "What do you mean by…?", "What happened next?"
- Ask about the context: who was involved, where it happened, what they were trying to accomplish.
- Ask about emotions and reactions: "How did that make you feel?", "What was going through your mind?"
- When they mention a workaround or frustration, explore it: "Why did you do it that way?" or "What would have been ideal?"

CONVERSATION MANAGEMENT:
- After consent is given, begin with an easy opening question to build rapport.
- Embrace silence — give the participant time to think before following up.
- Acknowledge what they share with brief affirmations ("I see", "That makes sense") but don't over-validate.
- Transition naturally between topics. Avoid abrupt shifts.
- If the participant goes off-topic, gently redirect: "That's interesting — I'd love to come back to that. Going back to…"

THINGS TO AVOID:
- Do not ask yes/no or binary-choice questions (except the consent question).
- Do not ask multiple questions at once.
- Do not share your own opinions, experiences, or reactions to what they say.
- Do not use jargon or technical terms unless the participant introduces them first.
- Do not summarize or rephrase what they said unless checking understanding.

PACING:
- Wait for the participant to finish their thought before responding. If they pause briefly, give them time — they may be collecting their thoughts.
- If a response seems incomplete, wait a moment, then gently prompt: "Take your time" or "Is there anything else you'd like to add?"
- Do not rush to the next question. Let pauses breathe.

HANDLING NON-ENGAGEMENT:
- If a participant gives a very short or off-topic answer, rephrase the question or ask from a different angle: "Let me ask that differently…" or "I'm curious about your direct experience with…"
- If the participant is clearly not engaging, giving nonsensical answers, or being disruptive, gently remind them: "I'd really appreciate your genuine thoughts on this — your real experience is what matters here."
- If the participant continues to not engage meaningfully after two gentle reminders, politely conclude the interview: "Thank you for your time today. I think we have enough to work with. We really appreciate you joining us."

ENDING THE INTERVIEW:
- When you have covered all your questions or topics, wrap up naturally: summarize what you've learned briefly (1 sentence), say a warm farewell to the participant, then call the 'end_interview' function.
- Your farewell message should thank them for their time and wish them well (e.g., "Thank you so much for sharing your experiences with me today. Have a great day!").
- After calling 'end_interview', do NOT ask any more questions or continue the conversation.

Keep the conversation natural, warm, and focused. Your goal is to deeply understand their experience through specific, real examples.`;

    // Create ephemeral token via OpenAI Realtime Sessions API
    const openaiRes = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2025-06-03",
          voice: "alloy",
          instructions: systemPrompt,
          input_audio_transcription: {
            model: "whisper-1",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.7,
            prefix_padding_ms: 400,
            silence_duration_ms: 1200,
          },
        }),
      },
    );

    if (!openaiRes.ok) {
      const err = await openaiRes.text().catch(() => "");
      logger.error("Failed to create OpenAI Realtime session", {
        sessionId,
        status: openaiRes.status,
        error: err.slice(0, 500),
      });
      return actionError("Failed to create AI session");
    }

    const realtimeSession = await openaiRes.json();
    return actionSuccess({
      clientSecret: realtimeSession.client_secret?.value || "",
      systemPrompt,
    });
  } catch (error) {
    logger.error("Error creating realtime session", { sessionId, error });
    return actionError("Failed to create AI session");
  }
}

// ============================================================================
// Transcript & Messages
// ============================================================================

/**
 * Save a batch of transcript messages from the interview.
 */
export async function saveInterviewMessages(
  sessionId: string,
  messages: Array<{
    speaker: "AI" | "PARTICIPANT";
    text: string;
    audioStartMs?: number;
    audioEndMs?: number;
  }>,
): Promise<ActionResult> {
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages }),
      },
    );

    if (!res.ok) {
      return actionError("Failed to save messages");
    }

    return actionSuccess();
  } catch (error) {
    logger.error("Failed to save interview messages", { sessionId, error });
    return actionError("Failed to save messages");
  }
}

/**
 * Get interview messages for the observer transcript view.
 */
export async function getInterviewMessages(
  sessionId: string,
  afterId?: string,
): Promise<ActionResult<any[]>> {
  try {
    let url = `${process.env.DB_WORKER_URL}/api/study/interview/session/messages?sessionId=${sessionId}`;
    if (afterId) {
      url += `&afterId=${afterId}`;
    }

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return actionError("Failed to get messages");
    }

    const { data } = await res.json();
    return actionSuccess(data || []);
  } catch (error) {
    logger.error("Failed to get interview messages", { sessionId, error });
    return actionError("Failed to get messages");
  }
}

// ============================================================================
// Observer Probes
// ============================================================================

/**
 * Observer sends a probe instruction to be injected into the AI conversation.
 */
export async function sendInterviewProbe(
  sessionId: string,
  text: string,
): Promise<ActionResult> {
  const user = await requireAuth();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/probe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text }),
      },
    );

    if (!res.ok) {
      return actionError("Failed to send probe");
    }

    return actionSuccess();
  } catch (error) {
    logger.error("Failed to send probe", { sessionId, userId: user.id, error });
    return actionError("Failed to send probe");
  }
}

/**
 * Get uninjected probes for the participant room to pick up.
 */
export async function getInterviewProbes(
  sessionId: string,
): Promise<ActionResult<any[]>> {
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/probes?sessionId=${sessionId}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      return actionError("Failed to get probes");
    }

    const { data } = await res.json();
    return actionSuccess(data || []);
  } catch (error) {
    logger.error("Failed to get probes", { sessionId, error });
    return actionError("Failed to get probes");
  }
}

// ============================================================================
// Session Lifecycle
// ============================================================================

/**
 * Update interview session status (SCHEDULED -> LIVE -> COMPLETED).
 */
export async function updateInterviewSessionStatus(
  sessionId: string,
  status: "SCHEDULED" | "LIVE" | "COMPLETED",
): Promise<ActionResult> {
  try {
    const updateData: Record<string, unknown> = { sessionId, status };
    if (status === "LIVE") {
      updateData.startedAt = new Date().toISOString();
    }
    if (status === "COMPLETED") {
      updateData.completedAt = new Date().toISOString();
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      },
    );

    if (!res.ok) {
      return actionError("Failed to update session status");
    }

    return actionSuccess();
  } catch (error) {
    logger.error("Failed to update session status", { sessionId, error });
    return actionError("Failed to update session status");
  }
}

/**
 * Finalize an interview session: set COMPLETED and optionally save recording key.
 */
export async function finalizeInterviewSession(
  sessionId: string,
  recordingKey?: string,
): Promise<ActionResult> {
  try {
    // Update status to COMPLETED
    const statusResult = await updateInterviewSessionStatus(
      sessionId,
      "COMPLETED",
    );
    if (!statusResult.success) return statusResult;

    // Save recording key if provided
    if (recordingKey) {
      await fetch(
        `${process.env.DB_WORKER_URL}/api/study/interview/session/recording`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, recordingKey }),
        },
      );
    }

    return actionSuccess();
  } catch (error) {
    logger.error("Failed to finalize session", { sessionId, error });
    return actionError("Failed to finalize session");
  }
}

/**
 * Generate a presigned PUT URL so the (unauthenticated) participant can
 * upload the audio recording for an interview session.
 * Validated by session existence rather than user auth.
 */
export async function getInterviewRecordingUploadUrl(
  sessionId: string,
): Promise<ActionResult<{ uploadUrl: string; key: string }>> {
  try {
    // Verify the session exists
    const detailRes = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/details?sessionId=${sessionId}`,
      { cache: "no-store" },
    );
    if (!detailRes.ok) {
      return actionError("Session not found");
    }
    const { data: detail } = await detailRes.json();
    if (!detail) {
      return actionError("Session not found");
    }

    const teamId = detail.interview?.study?.teamId;
    const prefix = teamId
      ? `studies/${teamId}`
      : `studies/${detail.interview?.study?.createdByUserId || "unknown"}`;
    const key = `${prefix}/interviews/${sessionId}/recording-${generateRandomFileName("recording.webm")}`;

    const uploadUrl = await generatePresignedPutUrl(
      key,
      "audio/webm",
      120, // 2 minutes to complete the upload
    );

    return actionSuccess({ uploadUrl, key });
  } catch (error) {
    logger.error("Failed to generate interview recording upload URL", {
      sessionId,
      error,
    });
    return actionError("Failed to generate upload URL");
  }
}

// ============================================================================
// Interview Session Rename
// ============================================================================

/**
 * Rename an interview session.
 */
export async function renameInterviewSession(
  sessionId: string,
  name: string,
): Promise<ActionResult> {
  const user = await requireAuth();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/name`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name }),
      },
    );

    if (!res.ok) {
      return actionError("Failed to rename session");
    }

    return actionSuccess(undefined);
  } catch (error) {
    logger.error("Failed to rename interview session", {
      sessionId,
      name,
      error,
    });
    return actionError("Failed to rename session");
  }
}

// ============================================================================
// Interview Data
// ============================================================================

/**
 * Get full interview data for the management UI.
 */
export async function getInterviewData(
  studyId: string,
): Promise<ActionResult<any>> {
  const user = await requireAuth();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/data?studyId=${studyId}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      return actionError("Failed to fetch interview data");
    }

    const { data } = await res.json();
    return actionSuccess(data);
  } catch (error) {
    logger.error("Failed to get interview data", {
      studyId,
      userId: user.id,
      error,
    });
    return actionError("Failed to fetch interview data");
  }
}

/**
 * Get interview session data by token (for participant/observer page loads).
 */
export async function getInterviewSessionByToken(token: string) {
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/token?token=${token}`,
      { cache: "no-store" },
    );

    if (!res.ok) return null;

    const { data } = await res.json();
    return data;
  } catch (error) {
    logger.error("Failed to get interview session by token", { token, error });
    return null;
  }
}

// ============================================================================
// LiveKit Token Generation
// ============================================================================

/**
 * Generate a LiveKit token for the interview audio relay room.
 * Participant gets publish rights, observer gets subscribe-only.
 */
export async function getInterviewLivekitToken(
  sessionId: string,
  role: "PARTICIPANT" | "OBSERVER",
): Promise<ActionResult<{ token: string; wsUrl: string }>> {
  try {
    const { AccessToken } = await import("livekit-server-sdk");

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return actionError("LiveKit configuration missing");
    }

    const identity = `interview-${role.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`;
    const participantName = role === "PARTICIPANT" ? "Participant" : "Observer";

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
    });

    at.addGrant({
      roomJoin: true,
      room: `interview-${sessionId}`,
      canPublish: role === "PARTICIPANT",
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return actionSuccess({ token, wsUrl });
  } catch (error) {
    logger.error("Failed to generate LiveKit token", { sessionId, error });
    return actionError("Failed to generate audio token");
  }
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Delete an interview session.
 */
export async function deleteInterviewSessionAction(
  sessionId: string,
): Promise<ActionResult> {
  const user = await requireAuth();

  try {
    // Fetch session details before deleting (for refund check)

    let isScheduled = false;
    let studyTeamId: string | null = null;
    let companyId: string | null = null;

    // Try to get session data via the session ID directly
    const detailRes = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/details?sessionId=${sessionId}`,
      { cache: "no-store" },
    );
    if (detailRes.ok) {
      const { data: detail } = await detailRes.json();
      isScheduled = detail?.status === "SCHEDULED";
      studyTeamId = detail?.interview?.study?.teamId || null;
      companyId = detail?.interview?.study?.team?.companyId || null;
    }

    // Delete the session
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session?sessionId=${sessionId}`,
      { method: "DELETE" },
    );

    if (!res.ok) {
      return actionError("Failed to delete session");
    }

    // Refund if session was never started
    if (isScheduled && studyTeamId) {
      const refundAmount = companyId
        ? COMPANY_INTERVIEW_COST_CENTS
        : PERSONAL_INTERVIEW_COST_CENTS;
      try {
        await addTeamBalance({
          teamId: studyTeamId,
          amountCents: refundAmount,
          byUserId: user.id,
          reason: "refund_session",
        });
        logger.info("Refunded interview session deletion", {
          sessionId,
          teamId: studyTeamId,
          refundAmount,
        });
      } catch (refundError) {
        logger.error("Failed to refund interview session deletion", {
          sessionId,
          teamId: studyTeamId,
          error: refundError,
        });
      }
    }

    return actionSuccess(undefined);
  } catch (error) {
    logger.error("Failed to delete interview session", { sessionId, error });
    return actionError("Failed to delete session");
  }
}
