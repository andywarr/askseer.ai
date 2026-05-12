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

  const startDate = sessionData.session.interview?.startDate;
  if (startDate && new Date(startDate) > new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Study Not Yet Open</h1>
          <p className="text-muted-foreground mt-2">
            This study hasn&apos;t opened yet. Please come back on or after{" "}
            {new Date(startDate).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            .
          </p>
        </div>
      </div>
    );
  }

  const endDate = sessionData.session.interview?.endDate;
  if (endDate && new Date(endDate) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Study Closed</h1>
          <p className="text-muted-foreground mt-2">
            This study&apos;s end date has passed and is no longer accepting
            responses. Thank you for your interest.
          </p>
        </div>
      </div>
    );
  }

  return (
    <InterviewParticipantRoom session={sessionData.session} token={token} />
  );
}
