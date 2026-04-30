import { notFound } from "next/navigation";
import { getInterviewSessionByToken } from "@/apps/nextjs-app/lib/actions/interview-actions";
import { InterviewParticipantRoom } from "@/apps/nextjs-app/components/interview/participant-room";

export const metadata = {
  title: "Interview – Seer",
};

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const sessionData = await getInterviewSessionByToken(token);

  if (!sessionData || sessionData.role !== "PARTICIPANT") {
    // If the token is for an observer, redirect to observer page
    if (sessionData?.role === "OBSERVER") {
      const { redirect } = await import("next/navigation");
      redirect(`/session/interview/observe/${token}`);
    }
    return notFound();
  }

  return (
    <InterviewParticipantRoom
      session={sessionData.session}
      token={token}
    />
  );
}
