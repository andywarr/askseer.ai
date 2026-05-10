import prisma from "@/apps/db-worker/src/services/db.ts";
import { logger } from "@/apps/shared/logger.ts";

// ─── Interview Init ─────────────────────────────────────────────────

export async function dbInitInterview(
  studyId: string,
  sessionCount: number = 1,
  endDate?: Date,
) {
  try {
    const interview = await prisma.interview.create({
      data: { studyId, ...(endDate ? { endDate } : {}) },
    });

    // Create N interview sessions
    const count = Math.max(1, Math.min(sessionCount, 24));
    const sessions = [];
    for (let i = 0; i < count; i++) {
      const session = await prisma.interviewSession.create({
        data: { interviewId: interview.id },
      });
      sessions.push(session);
    }

    logger.info("Successfully initialized interview with sessions", {
      studyId,
      interviewId: interview.id,
      sessionCount: sessions.length,
    });
    return { ...interview, sessions };
  } catch (error) {
    logger.error("Failed to initialize interview", { studyId, error });
    throw error;
  }
}

// ─── Session CRUD ───────────────────────────────────────────────────

export async function dbGetInterviewSessionDetails(sessionId: string) {
  try {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        interview: {
          include: {
            study: {
              include: {
                team: {
                  select: { id: true, companyId: true, balanceCents: true },
                },
              },
            },
          },
        },
      },
    });

    return session;
  } catch (error) {
    logger.error("Failed to get interview session details", {
      sessionId,
      error,
    });
    throw error;
  }
}

export async function dbInitInterviewSession(interviewId: string) {
  try {
    const session = await prisma.interviewSession.create({
      data: { interviewId },
    });

    logger.info("Successfully initialized interview session", {
      interviewId,
      sessionId: session.id,
      participantLink: session.participantLink,
      observerLink: session.observerLink,
    });
    return session;
  } catch (error) {
    logger.error("Failed to initialize interview session", {
      interviewId,
      error,
    });
    throw error;
  }
}

export async function dbGetInterviewSessionByToken(token: string) {
  try {
    const session = await prisma.interviewSession.findFirst({
      where: {
        OR: [{ participantLink: token }, { observerLink: token }],
      },
      include: {
        interview: {
          include: {
            study: {
              include: {
                team: true,
              },
            },
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100, // Last 100 messages for initial load
        },
      },
    });

    if (!session) return null;

    const role: "PARTICIPANT" | "OBSERVER" =
      session.participantLink === token ? "PARTICIPANT" : "OBSERVER";

    return { session, role };
  } catch (error) {
    logger.error("Failed to fetch interview session by token", {
      token,
      error,
    });
    throw error;
  }
}

export async function dbUpdateInterviewSessionStatus(data: {
  sessionId: string;
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "INCOMPLETE" | "PAUSED";
  startedAt?: Date;
  completedAt?: Date;
}) {
  try {
    const updateData: Record<string, unknown> = { status: data.status };
    if (data.startedAt) updateData.startedAt = data.startedAt;
    if (data.completedAt) updateData.completedAt = data.completedAt;

    const session = await prisma.interviewSession.update({
      where: { id: data.sessionId },
      data: updateData,
    });

    logger.info("Updated interview session status", {
      sessionId: data.sessionId,
      status: data.status,
    });
    return session;
  } catch (error) {
    logger.error("Failed to update interview session status", {
      data,
      error,
    });
    throw error;
  }
}

// ─── Messages ───────────────────────────────────────────────────────

export async function dbSaveInterviewMessages(
  sessionId: string,
  messages: Array<{
    speaker: "AI" | "PARTICIPANT";
    text: string;
    audioStartMs?: number;
    audioEndMs?: number;
  }>,
) {
  try {
    const result = await prisma.interviewMessage.createMany({
      data: messages.map((m) => ({
        sessionId,
        speaker: m.speaker,
        text: m.text,
        audioStartMs: m.audioStartMs ?? null,
        audioEndMs: m.audioEndMs ?? null,
      })),
    });

    logger.info("Saved interview messages", {
      sessionId,
      count: result.count,
    });
    return result;
  } catch (error) {
    logger.error("Failed to save interview messages", { sessionId, error });
    throw error;
  }
}

export async function dbGetInterviewMessages(
  sessionId: string,
  afterId?: string,
) {
  try {
    const messages = await prisma.interviewMessage.findMany({
      where: {
        sessionId,
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return messages;
  } catch (error) {
    logger.error("Failed to get interview messages", { sessionId, error });
    throw error;
  }
}

// ─── Probes ─────────────────────────────────────────────────────────

export async function dbSaveInterviewProbe(sessionId: string, text: string) {
  try {
    const probe = await prisma.interviewProbeMessage.create({
      data: { sessionId, text },
    });

    logger.info("Saved interview probe", {
      sessionId,
      probeId: probe.id,
    });
    return probe;
  } catch (error) {
    logger.error("Failed to save interview probe", { sessionId, error });
    throw error;
  }
}

export async function dbGetUninjectedProbes(sessionId: string) {
  try {
    // Fetch uninjected probes
    const probes = await prisma.interviewProbeMessage.findMany({
      where: { sessionId, injected: false },
      orderBy: { createdAt: "asc" },
    });

    // Mark them as injected
    if (probes.length > 0) {
      await prisma.interviewProbeMessage.updateMany({
        where: {
          id: { in: probes.map((p) => p.id) },
        },
        data: { injected: true },
      });
    }

    return probes;
  } catch (error) {
    logger.error("Failed to get uninjected probes", { sessionId, error });
    throw error;
  }
}

// ─── Recording ──────────────────────────────────────────────────────

export async function dbSaveInterviewRecording(
  sessionId: string,
  recordingKey: string,
) {
  try {
    const session = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { recordingKey },
    });

    logger.info("Saved interview recording key", { sessionId, recordingKey });
    return session;
  } catch (error) {
    logger.error("Failed to save interview recording", {
      sessionId,
      error,
    });
    throw error;
  }
}

// ─── Guide (AI Worker → DB) ────────────────────────────────────────

export async function dbSaveInterviewGuide(
  studyId: string,
  data: {
    goal?: string;
    rawDiscussionGuide?: string;
    systemPrompt?: string;
    estimatedDurationMinutes?: number;
    questions?: Array<{
      text: string;
      type: "QUESTION" | "TASK";
      order: number;
    }>;
    studyName?: string;
  },
) {
  try {
    // Upsert the interview record with goal, guide, and system prompt
    const interview = await prisma.interview.upsert({
      where: { studyId },
      create: {
        studyId,
        goal: data.goal,
        rawDiscussionGuide: data.rawDiscussionGuide,
        systemPrompt: data.systemPrompt,
        estimatedDurationMinutes: data.estimatedDurationMinutes,
      },
      update: {
        goal: data.goal,
        rawDiscussionGuide: data.rawDiscussionGuide,
        systemPrompt: data.systemPrompt,
        estimatedDurationMinutes: data.estimatedDurationMinutes,
      },
    });

    // If questions are provided, delete existing and recreate
    if (data.questions && data.questions.length > 0) {
      await prisma.interviewQuestion.deleteMany({
        where: { interviewId: interview.id },
      });

      await prisma.interviewQuestion.createMany({
        data: data.questions.map((q) => ({
          interviewId: interview.id,
          text: q.text,
          type: q.type,
          order: q.order,
        })),
      });
    }

    // Update study status to COMPLETED and set generated name if needed
    const studyUpdate: Record<string, unknown> = { status: "COMPLETED" };
    if (data.studyName) {
      studyUpdate.name = data.studyName;
    }
    await prisma.study.update({
      where: { id: studyId },
      data: studyUpdate,
    });

    logger.info("Saved interview guide data", {
      studyId,
      interviewId: interview.id,
      questionCount: data.questions?.length ?? 0,
      hasSystemPrompt: !!data.systemPrompt,
    });

    return interview;
  } catch (error) {
    logger.error("Failed to save interview guide", { studyId, error });
    throw error;
  }
}

// ─── Transcripts (for analysis) ─────────────────────────────────────

export async function dbGetInterviewTranscripts(interviewId: string) {
  try {
    const sessions = await prisma.interviewSession.findMany({
      where: {
        interviewId,
        status: "COMPLETED",
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return sessions;
  } catch (error) {
    logger.error("Failed to get interview transcripts", {
      interviewId,
      error,
    });
    throw error;
  }
}

// ─── Full Interview Data (for management UI) ────────────────────────

export async function dbGetInterviewData(studyId: string) {
  try {
    const interview = await prisma.interview.findUnique({
      where: { studyId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        sessions: {
          orderBy: { createdAt: "desc" },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                speaker: true,
                text: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return interview;
  } catch (error) {
    logger.error("Failed to get interview data", { studyId, error });
    throw error;
  }
}

export async function dbDeleteInterviewSession(sessionId: string) {
  try {
    await prisma.interviewSession.delete({
      where: { id: sessionId },
    });

    logger.info("Deleted interview session", { sessionId });
    return { success: true };
  } catch (error) {
    logger.error("Failed to delete interview session", { sessionId, error });
    throw error;
  }
}

export async function dbRenameInterviewSession(
  sessionId: string,
  name: string,
) {
  try {
    const session = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { name },
    });

    logger.info("Renamed interview session", { sessionId, name });
    return session;
  } catch (error) {
    logger.error("Failed to rename interview session", {
      sessionId,
      name,
      error,
    });
    throw error;
  }
}

// ─── Pause / End Date ───────────────────────────────────────────────

export async function dbPauseInterviewSession(
  sessionId: string,
  participantEmail: string,
) {
  try {
    const session = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "PAUSED",
        pausedAt: new Date(),
        participantEmail,
      },
    });

    logger.info("Paused interview session", { sessionId, participantEmail });
    return session;
  } catch (error) {
    logger.error("Failed to pause interview session", { sessionId, error });
    throw error;
  }
}

export async function dbUpdateInterviewEndDate(
  interviewId: string,
  endDate: Date | null,
) {
  try {
    const interview = await prisma.interview.update({
      where: { id: interviewId },
      data: { endDate },
    });

    logger.info("Updated interview end date", { interviewId, endDate });
    return interview;
  } catch (error) {
    logger.error("Failed to update interview end date", {
      interviewId,
      error,
    });
    throw error;
  }
}

// ─── Reminder Queries ───────────────────────────────────────────────

export async function dbGetPausedSessionsDueForReminder() {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const sessions = await prisma.interviewSession.findMany({
      where: {
        status: "PAUSED",
        participantEmail: { not: null },
        OR: [
          // No end date: one reminder 3 days after pausing
          {
            interview: { endDate: null },
            pausedAt: { lte: threeDaysAgo },
            reminderSentAt: null,
          },
          // With end date: reminder when 3 days remain and no reminder sent yet
          {
            interview: { endDate: { lte: threeDaysFromNow, gte: now } },
            reminderSentAt: null,
          },
          // With end date: reminder when 1 day remains (reminderSentAt must be before 2-days-out threshold)
          {
            interview: { endDate: { lte: oneDayFromNow, gte: now } },
            reminderSentAt: { lt: twoDaysFromNow },
          },
        ],
      },
      include: {
        interview: { select: { endDate: true, studyId: true } },
      },
    });

    return sessions;
  } catch (error) {
    logger.error("Failed to get paused sessions due for reminder", { error });
    throw error;
  }
}

export async function dbGetExpiredPausedSessions() {
  try {
    const now = new Date();
    const sessions = await prisma.interviewSession.findMany({
      where: {
        status: "PAUSED",
        interview: { endDate: { lt: now } },
      },
      select: { id: true },
    });

    return sessions;
  } catch (error) {
    logger.error("Failed to get expired paused sessions", { error });
    throw error;
  }
}

export async function dbMarkReminderSent(sessionId: string) {
  try {
    const session = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { reminderSentAt: new Date() },
    });

    logger.info("Marked reminder sent", { sessionId });
    return session;
  } catch (error) {
    logger.error("Failed to mark reminder sent", { sessionId, error });
    throw error;
  }
}

export async function dbBulkExpirePausedSessions(sessionIds: string[]) {
  try {
    const result = await prisma.interviewSession.updateMany({
      where: { id: { in: sessionIds }, status: "PAUSED" },
      data: { status: "INCOMPLETE" },
    });

    logger.info("Bulk expired paused sessions", {
      count: result.count,
      sessionIds,
    });
    return result;
  } catch (error) {
    logger.error("Failed to bulk expire paused sessions", {
      sessionIds,
      error,
    });
    throw error;
  }
}
