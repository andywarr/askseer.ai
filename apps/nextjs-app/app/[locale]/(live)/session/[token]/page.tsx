import { notFound } from "next/navigation";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import {
  getLiveSessionByTokenDb,
  setLiveSessionInterviewerDb,
} from "@/apps/nextjs-app/lib/db/data";
import { LiveSessionRoom } from "@/apps/nextjs-app/components/live-session/live-session-room";
import { isAuthenticated } from "@/apps/nextjs-app/lib/db/dal";
import { MAX_LIVE_SESSION_PARTICIPANTS } from "@/apps/shared/constants";
import { logger } from "@/apps/shared/logger";

export default async function LiveSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getLiveSessionByTokenDb(token);

  if (!data) {
    return notFound();
  }

  const { session, role } = data;

  // Interviewer and Observer links require a logged-in Seer user.
  // The participant (CUSTOMER) link remains publicly accessible.
  let authenticatedUserId: string | null = null;
  if (role === "INTERVIEWER" || role === "OBSERVER") {
    const authResult = await isAuthenticated(); // redirects to /signin if not logged in
    authenticatedUserId = authResult.userId;
  }

  // Only the study creator can join as interviewer
  if (
    role === "INTERVIEWER" &&
    authenticatedUserId !== session.study?.createdByUserId
  ) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <div className="bg-destructive/10 text-destructive max-w-md rounded-lg p-6">
          <h2 className="mb-2 text-xl font-semibold">Access Denied</h2>
          <p>Only the study creator can join as the interviewer.</p>
        </div>
      </div>
    );
  }

  // Record which user is the interviewer for this session
  if (role === "INTERVIEWER" && authenticatedUserId) {
    setLiveSessionInterviewerDb(session.id, authenticatedUserId).catch(
      () => {}, // best-effort, don't block page render
    );
  }

  // Ensure LiveKit credentials are set
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <div className="bg-destructive/10 text-destructive max-w-md rounded-lg p-6">
          <h2 className="mb-2 text-xl font-semibold">
            LiveKit Configuration Missing
          </h2>
          <p>
            The server is missing LiveKit credentials. Please configure
            LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and NEXT_PUBLIC_LIVEKIT_URL.
          </p>
        </div>
      </div>
    );
  }

  // Enforce participant limit
  try {
    const roomService = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    const participants = await roomService.listParticipants(session.id);
    if (participants.length >= MAX_LIVE_SESSION_PARTICIPANTS) {
      return (
        <div className="flex h-screen items-center justify-center p-4 text-center">
          <div className="max-w-md rounded-lg bg-amber-50 p-6 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <h2 className="mb-2 text-xl font-semibold">Session Full</h2>
            <p>
              This session has reached its maximum of{" "}
              {MAX_LIVE_SESSION_PARTICIPANTS} participants. Please try again
              later or contact the study creator.
            </p>
          </div>
        </div>
      );
    }
  } catch (err) {
    // Room may not exist yet (first joiner) — that's fine, allow through
    logger.warn("Could not check participant count; allowing join", {
      error: err,
    });
  }

  // Generate identity for the user
  const identity = authenticatedUserId
    ? `${role.toLowerCase()}-${authenticatedUserId}`
    : `${role.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`;
  const participantName =
    role === "CUSTOMER"
      ? "Participant"
      : role === "INTERVIEWER"
        ? "Interviewer"
        : "Observer";

  // Create token
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: participantName,
  });

  // Set permissions based on role
  const isObserver = role === "OBSERVER";
  const isInterviewer = role === "INTERVIEWER";

  at.addGrant({
    roomJoin: true,
    room: session.id,
    canPublish: !isObserver, // Observers cannot publish audio/video
    canPublishData: true, // Everyone can publish data (e.g., chat, tags)
    canSubscribe: true,
  });

  const livekitToken = await at.toJwt();

  // Enrich session with extracted discussion guide text for the teleprompter.
  // The guide document is uploaded as a Study file (PDF/txt/doc). The AI worker
  // extracts its text and caches it in File.transcript via buildFileContent().
  // We look for the first non-media file with a cached transcript.
  const studyFiles: any[] = (session as any).study?.files ?? [];
  const guideFile = studyFiles.find(
    (f: any) =>
      f.transcript &&
      !["AUDIO", "VIDEO"].includes((f.fileType || "").toUpperCase()),
  );

  logger.info("Teleprompter guide lookup", {
    sessionId: session.id,
    studyFileCount: studyFiles.length,
    studyFileTypes: studyFiles.map((f: any) => ({
      name: f.originalName,
      type: f.fileType,
      hasTranscript: !!f.transcript,
      transcriptLen: f.transcript?.length ?? 0,
    })),
    hasGuideText: !!guideFile?.transcript,
  });

  const sessionWithGuide = {
    ...session,
    discussionGuideText: guideFile?.transcript ?? null,
  };

  return (
    <LiveSessionRoom
      token={livekitToken}
      wsUrl={wsUrl}
      role={role}
      session={sessionWithGuide}
    />
  );
}
