import { notFound } from "next/navigation";
import { getInterviewSessionByToken } from "@/apps/nextjs-app/lib/actions/interview-actions";
import { InterviewObserverRoom } from "@/apps/nextjs-app/components/interview/observer-room";
import { isAuthenticated } from "@/apps/nextjs-app/lib/db/dal";

export const metadata = {
  title: "Interview Observer – Seer",
};

export default async function InterviewObserverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  await isAuthenticated(); // redirects to /signin if not logged in

  const sessionData = await getInterviewSessionByToken(token);

  if (!sessionData || sessionData.role !== "OBSERVER") {
    // If the token is for a participant, redirect to participant page
    if (sessionData?.role === "PARTICIPANT") {
      const { redirect } = await import("next/navigation");
      redirect(`/session/interview/${token}`);
    }
    return notFound();
  }

  const endDate = sessionData.session.interview?.endDate;
  if (endDate && new Date(endDate) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Study Closed</h1>
          <p className="text-muted-foreground mt-2">
            This study&apos;s end date has passed.
          </p>
        </div>
      </div>
    );
  }

  return <InterviewObserverRoom session={sessionData.session} token={token} />;
}
