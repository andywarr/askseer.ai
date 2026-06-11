import { notFound } from "next/navigation";
import { getInterviewSessionByToken } from "@/apps/nextjs-app/lib/actions/interview-actions";
import { InterviewParticipantRoom } from "@/apps/nextjs-app/components/interview/participant-room";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Interview – Seer",
};

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token, locale } = await params;
  const t = await getTranslations("LiveSession");

  const sessionData = await getInterviewSessionByToken(token);

  if (!sessionData || sessionData.role !== "PARTICIPANT") {
    // If the token is for an observer, redirect to observer page
    if (sessionData?.role === "OBSERVER") {
      const { redirect } = await import("next/navigation");
      const redirectPath = locale === "en"
        ? `/session/interview/observe/${token}`
        : `/${locale}/session/interview/observe/${token}`;
      redirect(redirectPath);
    }
    return notFound();
  }

  const startDate = sessionData.session.interview?.startDate;
  if (startDate && new Date(startDate) > new Date()) {
    const formattedDate = new Date(startDate).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center animate-in fade-in zoom-in duration-300">
          <h1 className="text-2xl font-bold">{t("dateCheck.notOpenTitle")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("dateCheck.notOpenDescription", { date: formattedDate })}
          </p>
        </div>
      </div>
    );
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

  return (
    <InterviewParticipantRoom session={sessionData.session} token={token} />
  );
}
