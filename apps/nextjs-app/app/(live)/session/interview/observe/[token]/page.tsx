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

  return <InterviewObserverRoom session={sessionData.session} token={token} />;
}
