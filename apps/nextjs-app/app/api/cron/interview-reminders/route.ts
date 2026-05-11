import { NextRequest, NextResponse } from "next/server";
import { createStyledEmailHtml } from "@/apps/nextjs-app/lib/integrations/email-templates";
import {
  getResendClient,
  getSenderEmail,
} from "@/apps/nextjs-app/lib/integrations/resend";
import { logger } from "@/apps/shared/logger";
import {
  PERSONAL_INTERVIEW_COST_CENTS,
  COMPANY_INTERVIEW_COST_CENTS,
} from "@/apps/shared/constants";

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

  const results = {
    reminders: { sent: 0, failed: 0 },
    expired: { count: 0, failed: 0 },
    cancelled: { count: 0, refunded: 0, failed: 0 },
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
          const resend = getResendClient();
          await resend.emails.send({
            from: getSenderEmail(),
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

  // ── 3. Cancel scheduled sessions for expired interviews + refund ─

  try {
    const scheduledExpiredRes = await fetch(
      `${dbWorkerUrl}/api/study/interview/session/scheduled-expired`,
      { cache: "no-store" },
    );

    if (scheduledExpiredRes.ok) {
      const { data: scheduledSessions } = await scheduledExpiredRes.json();
      const sessions: Array<{
        id: string;
        interview: {
          study: { id: string; team: { id: string; companyId: string | null } };
        };
      }> = scheduledSessions || [];

      if (sessions.length > 0) {
        // Cancel all sessions in one call
        const cancelRes = await fetch(
          `${dbWorkerUrl}/api/study/interview/session/bulk-cancel`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionIds: sessions.map((s) => s.id) }),
          },
        );

        if (cancelRes.ok) {
          results.cancelled.count = sessions.length;
          logger.info(
            "Bulk cancelled scheduled sessions for expired interviews",
            {
              count: sessions.length,
            },
          );
        } else {
          results.cancelled.failed = sessions.length;
          logger.error("Failed to bulk cancel scheduled sessions");
        }

        // Refund each session's cost to the team
        for (const session of sessions) {
          const team = session.interview.study.team;
          const isCompany = !!team.companyId;
          const costCents = isCompany
            ? COMPANY_INTERVIEW_COST_CENTS
            : PERSONAL_INTERVIEW_COST_CENTS;

          try {
            await fetch(`${dbWorkerUrl}/api/team/balance/adjust`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId: team.id,
                amountCents: costCents,
                studyId: session.interview.study.id,
                reason: "refund_cancelled_session",
              }),
            });
            results.cancelled.refunded++;
            logger.info("Refunded cancelled session", {
              sessionId: session.id,
              teamId: team.id,
              costCents,
            });
          } catch (err) {
            logger.error("Failed to refund cancelled session", {
              sessionId: session.id,
              error: err,
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error("Failed to fetch/cancel scheduled expired sessions", {
      error: err,
    });
  }

  return NextResponse.json({ ok: true, results });
}
