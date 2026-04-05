import prisma from "@/apps/db-worker/src/services/db.ts";
import { Prisma } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";

export async function dbInitLiveSession(data: {
  studyId: string;
  name?: string;
  guideFileId?: string;
}) {
  try {
    const liveSession = await prisma.liveSession.create({
      data: {
        studyId: data.studyId,
        name: data.name || null,
        guideFileId: data.guideFileId || null,
      },
    });

    logger.info("Successfully initialized live session", {
      studyId: data.studyId,
      liveSessionId: liveSession.id,
    });
    return liveSession;
  } catch (error) {
    logger.error("Failed to initialize live session", {
      studyId: data.studyId,
      error,
    });
    throw error;
  }
}

export async function dbAttachLiveSessionGuide(data: {
  studyId: string;
  liveSessionId?: string;
  file: { key: string; name: string; size: number; type: string };
}) {
  try {
    const bucket = process.env.AWS_BUCKET || "";

    // Look up by explicit liveSessionId if provided, otherwise fall back to studyId
    const session = data.liveSessionId
      ? await prisma.liveSession.findUnique({
          where: { id: data.liveSessionId },
          include: { study: true },
        })
      : await prisma.liveSession.findFirst({
          where: { studyId: data.studyId },
          orderBy: { createdAt: "asc" },
          include: { study: true },
        });

    if (!session) {
      throw new Error(`LiveSession for studyId ${data.studyId} not found`);
    }

    // Determine type (from convertToFileType logic in helpers)
    const { convertToFileType } = await import("../shared/helpers.ts");
    const fileType = convertToFileType(data.file.type);

    const dbFile = await prisma.file.create({
      data: {
        studyId: data.studyId,
        bucket,
        key: data.file.key,
        originalName: data.file.name,
        size: data.file.size,
        fileType,
      },
    });

    const updated = await prisma.liveSession.update({
      where: { id: session.id },
      data: { guideFileId: dbFile.id },
    });

    logger.info("Successfully attached guide file to live session", {
      studyId: data.studyId,
      fileId: dbFile.id,
    });

    return updated;
  } catch (error) {
    logger.error("Failed to attach guide file to live session", {
      studyId: data.studyId,
      error,
    });
    throw error;
  }
}

export async function dbGetLiveSessionByToken(token: string) {
  try {
    const session = await prisma.liveSession.findFirst({
      where: {
        OR: [
          { interviewerLink: token },
          { customerLink: token },
          { observerLink: token },
        ],
      },
      include: {
        study: {
          include: {
            team: true,
            files: true,
          },
        },
        guideFile: true,
      },
    });

    if (!session) return null;

    let role: "INTERVIEWER" | "CUSTOMER" | "OBSERVER" = "CUSTOMER";
    if (session.interviewerLink === token) role = "INTERVIEWER";
    else if (session.observerLink === token) role = "OBSERVER";

    return { session, role };
  } catch (error) {
    logger.error("Failed to fetch live session by token", { token, error });
    throw error;
  }
}

export async function dbCreateLiveSessionTag(data: {
  liveSessionId: string;
  userId: string | null;
  tagType: "BUG" | "IDEA" | "PAIN_POINT" | "INSIGHT";
  timestamp: number;
  screenshotKey?: string | null;
}) {
  try {
    return await prisma.liveSessionTag.create({
      data: {
        liveSessionId: data.liveSessionId,
        userId: data.userId,
        tagType: data.tagType,
        timestamp: data.timestamp,
        ...(data.screenshotKey ? { screenshotKey: data.screenshotKey } : {}),
      },
    });
  } catch (error) {
    logger.error("Failed to create live session tag", { data, error });
    throw error;
  }
}

export async function dbCreateLiveSessionNote(data: {
  liveSessionId: string;
  userId: string | null;
  text: string;
  timestamp: number;
  screenshotKey?: string | null;
}) {
  try {
    return await prisma.liveSessionNote.create({
      data: {
        liveSessionId: data.liveSessionId,
        userId: data.userId,
        text: data.text,
        timestamp: data.timestamp,
        ...(data.screenshotKey ? { screenshotKey: data.screenshotKey } : {}),
      },
    });
  } catch (error) {
    logger.error("Failed to create live session note", { data, error });
    throw error;
  }
}

export async function dbFinalizeLiveSessionRecording(data: {
  liveSessionId: string;
  fileKey: string;
  fileSize: number;
}) {
  try {
    const liveSession = await prisma.liveSession.findUnique({
      where: { id: data.liveSessionId },
      include: { study: true },
    });

    if (!liveSession) {
      // Assuming BadRequestError is defined elsewhere or should be a standard Error
      throw new Error("Live Session not found");
    }

    const study = liveSession.study;

    // Attach the file to the study and store the S3 key on the session
    await Promise.all([
      prisma.file.create({
        data: {
          originalName: "recording.mp4",
          key: data.fileKey,
          size: data.fileSize,
          fileType: "VIDEO",
          bucket: process.env.AWS_BUCKET || "",
          studyId: study.id,
        },
      }),
      prisma.liveSession.update({
        where: { id: data.liveSessionId },
        data: { recordingKey: data.fileKey },
      }),
    ]);

    logger.info("Successfully saved recording for Live Session", {
      liveSessionId: data.liveSessionId,
      studyId: study.id,
      fileKey: data.fileKey,
    });

    return {
      studyId: study.id,
      userId: study.createdByUserId,
      teamId: study.teamId,
      jobData: study.jobData,
    };
  } catch (error) {
    logger.error("Failed to finalize live session recording", { data, error });
    throw error;
  }
}

// ─── Backroom Chat ──────────────────────────────────────────────────────────

export async function dbCreateBackroomMessage(data: {
  liveSessionId: string;
  userId: string | null;
  text: string;
  timestamp: number;
}) {
  try {
    const message = await prisma.backroomMessage.create({
      data: {
        liveSessionId: data.liveSessionId,
        userId: data.userId,
        text: data.text,
        timestamp: data.timestamp,
      },
    });
    return message;
  } catch (error) {
    logger.error("Failed to create backroom message", { data, error });
    throw error;
  }
}

export async function dbGetBackroomMessages(liveSessionId: string) {
  try {
    const messages = await prisma.backroomMessage.findMany({
      where: { liveSessionId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });
    return messages;
  } catch (error) {
    logger.error("Failed to get backroom messages", { liveSessionId, error });
    throw error;
  }
}

// ─── Session Lifecycle ──────────────────────────────────────────────────────

export async function dbUpdateLiveSessionStatus(data: {
  liveSessionId: string;
  status: "SCHEDULED" | "LIVE" | "ENDED" | "PROCESSING" | "COMPLETED";
  startedAt?: Date | null;
  endedAt?: Date;
  recordingKey?: string;
}) {
  try {
    const updateData: Prisma.LiveSessionUpdateInput = { status: data.status };
    if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;
    if (data.endedAt) updateData.endedAt = data.endedAt;
    if (data.recordingKey) updateData.recordingKey = data.recordingKey;

    const session = await prisma.liveSession.update({
      where: { id: data.liveSessionId },
      data: updateData,
    });

    logger.info("Updated live session status", {
      liveSessionId: data.liveSessionId,
      status: data.status,
    });

    return session;
  } catch (error) {
    logger.error("Failed to update live session status", { data, error });
    throw error;
  }
}

export async function dbGetLiveSessionDetails(liveSessionId: string) {
  try {
    const session = await prisma.liveSession.findUnique({
      where: { id: liveSessionId },
      include: {
        study: {
          include: {
            team: true,
            files: true,
          },
        },
        guideFile: true,
        tags: {
          orderBy: { timestamp: "asc" },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        notes: {
          orderBy: { timestamp: "asc" },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        backroomMessages: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    return session;
  } catch (error) {
    logger.error("Failed to get live session details", {
      liveSessionId,
      error,
    });
    throw error;
  }
}

export async function dbSaveLiveSessionTranscript(data: {
  liveSessionId: string;
  transcriptKey: string;
  transcriptText: string;
}) {
  try {
    const session = await prisma.liveSession.update({
      where: { id: data.liveSessionId },
      data: {
        transcriptKey: data.transcriptKey,
        transcriptText: data.transcriptText,
        status: "COMPLETED",
      },
    });

    logger.info("Saved live session transcript", {
      liveSessionId: data.liveSessionId,
    });

    return session;
  } catch (error) {
    logger.error("Failed to save live session transcript", { data, error });
    throw error;
  }
}

export async function dbRenameLiveSession(liveSessionId: string, name: string) {
  try {
    const session = await prisma.liveSession.update({
      where: { id: liveSessionId },
      data: { name },
    });

    logger.info("Renamed live session", { liveSessionId, name });
    return session;
  } catch (error) {
    logger.error("Failed to rename live session", {
      liveSessionId,
      name,
      error,
    });
    throw error;
  }
}

export async function dbDeleteLiveSession(liveSessionId: string) {
  try {
    await prisma.liveSession.delete({
      where: { id: liveSessionId },
    });

    logger.info("Deleted live session", { liveSessionId });
    return { success: true };
  } catch (error) {
    logger.error("Failed to delete live session", { liveSessionId, error });
    throw error;
  }
}

export async function dbSetRecordingStartedAt(liveSessionId: string) {
  try {
    const session = await prisma.liveSession.update({
      where: { id: liveSessionId },
      data: { recordingStartedAt: new Date() },
    });

    logger.info("Set recording started at", { liveSessionId });
    return session;
  } catch (error) {
    logger.error("Failed to set recording started at", {
      liveSessionId,
      error,
    });
    throw error;
  }
}

export async function dbSetLiveSessionInterviewer(
  liveSessionId: string,
  userId: string,
) {
  try {
    const session = await prisma.liveSession.update({
      where: { id: liveSessionId },
      data: { interviewerUserId: userId },
    });

    logger.info("Set live session interviewer", { liveSessionId, userId });
    return session;
  } catch (error) {
    logger.error("Failed to set live session interviewer", {
      liveSessionId,
      userId,
      error,
    });
    throw error;
  }
}
