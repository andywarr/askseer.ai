import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createStyledEmailHtml } from "@/apps/nextjs-app/lib/integrations/email-templates";
import { logger } from "@/apps/shared/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized invocations
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbWorkerUrl = process.env.DB_WORKER_URL;
  if (!dbWorkerUrl) {
    return NextResponse.json(
      { error: "DB_WORKER_URL not configured" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://app.askseer.ai";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.askseer.ai";

  const results = {
    reminders: { sent: 0, failed: 0 },
    expired: { count: 0, failed: 0 },
  };

  // ── 1. Send reminder emails ──────────────────────────────────────

  try {
    const remindersRes = await fetch(
      `${dbWorkerUrl}/api/study/interview/session/reminders-due`,
      { cache: "no-store" },
    );

    if (remindersRes.ok) {
      const { data: sessions } = await remindersRes.json();

      for (const session of sessions || []) {
        if (!session.participantEmail) continue;

        const resumeUrl = `${baseUrl}/session/interview/${session.participantLink}`;
        const endDate = session.interview?.endDate
          ? new Date(session.interview.endDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : null;

        const bodyHtml = endDate
          ? `<p>You paused an interview study earlier. The study closes on <strong>${endDate}</strong> — don't miss your chance to complete it!</p>
             <p style="text-align:center;margin:24px 0;">
               <a href="${resumeUrl}" style="background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Continue Interview</a>
             </p>
             <p>If the button doesn't work, copy this link into your browser:<br/><a href="${resumeUrl}">${resumeUrl}</a></p>`
          : `<p>You started an interview study a few days ago and paused it. Your responses are still saved — pick up right where you left off!</p>
             <p style="text-align:center;margin:24px 0;">
               <a href="${resumeUrl}" style="background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Continue Interview</a>
             </p>
             <p>If the button doesn't work, copy this link into your browser:<br/><a href="${resumeUrl}">${resumeUrl}</a></p>`;

        const html = createStyledEmailHtml({
          title: "Don't forget to complete your interview",
          subtitle: endDate
            ? `Study closes ${endDate}`
            : "Your responses are waiting",
          content: bodyHtml,
        });

        try {
          await resend.emails.send({
            from: fromEmail,
            to: session.participantEmail,
            subject: "Don't forget to complete your interview",
            html,
          });

          // Mark reminder as sent
          await fetch(
            `${dbWorkerUrl}/api/study/interview/session/reminder-sent`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: session.id }),
            },
          );

          results.reminders.sent++;
          logger.info("Sent interview reminder email", {
            sessionId: session.id,
            email: session.participantEmail,
          });
        } catch (err) {
          results.reminders.failed++;
          logger.error("Failed to send interview reminder email", {
            sessionId: session.id,
            error: err,
          });
        }
      }
    }
  } catch (err) {
    logger.error("Failed to fetch reminders-due sessions", { error: err });
  }

  // ── 2. Expire overdue paused sessions ───────────────────────────

  try {
    const expiredRes = await fetch(
      `${dbWorkerUrl}/api/study/interview/session/expired`,
      { cache: "no-store" },
    );

    if (expiredRes.ok) {
      const { data: expiredSessions } = await expiredRes.json();
      const sessionIds = (expiredSessions || []).map(
        (s: { id: string }) => s.id,
      );

      if (sessionIds.length > 0) {
        const bulkRes = await fetch(
          `${dbWorkerUrl}/api/study/interview/session/bulk-expire`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionIds }),
          },
        );

        if (bulkRes.ok) {
          results.expired.count = sessionIds.length;
          logger.info("Bulk expired paused interview sessions", {
            count: sessionIds.length,
          });
        } else {
          results.expired.failed = sessionIds.length;
          logger.error("Failed to bulk expire paused sessions");
        }
      }
    }
  } catch (err) {
    logger.error("Failed to fetch/expire expired sessions", { error: err });
  }

  return NextResponse.json({ ok: true, results });
}
