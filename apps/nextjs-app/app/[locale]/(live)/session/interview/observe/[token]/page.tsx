import { notFound } from "next/navigation";
import { getInterviewSessionByToken } from "@/apps/nextjs-app/lib/actions/interview-actions";
import { InterviewObserverRoom } from "@/apps/nextjs-app/components/interview/observer-room";
import { isAuthenticated } from "@/apps/nextjs-app/lib/db/dal";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Interview Observer – Seer",
};

export default async function InterviewObserverPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token, locale } = await params;
  const t = await getTranslations("LiveSession");

  await isAuthenticated(); // redirects to /signin if not logged in

  const sessionData = await getInterviewSessionByToken(token);

  if (!sessionData || sessionData.role !== "OBSERVER") {
    // If the token is for a participant, redirect to participant page
    if (sessionData?.role === "PARTICIPANT") {
      const { redirect } = await import("next/navigation");
      const redirectPath = locale === "en"
        ? `/session/interview/${token}`
        : `/${locale}/session/interview/${token}`;
      redirect(redirectPath);
    }
    return notFound();
  }

  const endDate = sessionData.session.interview?.endDate;
  if (endDate && new Date(endDate) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center animate-in fade-in zoom-in duration-300">
          <h1 className="text-2xl font-bold">{t("dateCheck.closedTitle")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("dateCheck.closedDescription")}
          </p>
        </div>
      </div>
    );
  }

  return <InterviewObserverRoom session={sessionData.session} token={token} />;
}
