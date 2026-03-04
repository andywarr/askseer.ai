import { notFound } from "next/navigation";
import { AccessToken } from "livekit-server-sdk";
import { getLiveSessionByTokenDb } from "@/apps/nextjs-app/lib/db/data";
import { LiveSessionRoom } from "@/apps/nextjs-app/components/live-session/live-session-room";
import { isAuthenticated } from "@/apps/nextjs-app/lib/db/dal";

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
    hidden: isObserver, // Hide observers from the main generic participant list if supported, or handle in UI
  });

  const livekitToken = await at.toJwt();

  return (
    <LiveSessionRoom
      token={livekitToken}
      wsUrl={wsUrl}
      role={role}
      session={session}
    />
  );
}
