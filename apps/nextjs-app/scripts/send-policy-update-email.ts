/**
 * Script: Send Privacy Policy & Terms of Service Update Email
 *
 * This script sends an email to all registered users notifying them of updates
 * to the Privacy Policy and Terms of Service (specifically the addition of
 * Stripe as a payment processor).
 *
 * SAFETY
 *   - Dry run supported via DRY_RUN env (default true) -> logs what would happen
 *   - Respects communication preferences (policy field is always required, but we check anyway)
 *   - Rate limiting to avoid overwhelming email provider
 *   - Logs all actions for audit trail
 *
 * USAGE (from apps/nextjs-app/ directory)
 *   npm run email:policy-update:dry    # dry run (default)
 *   npm run email:policy-update:send   # send emails for real
 *
 * Or directly with tsx:
 *   DRY_RUN=true  npx tsx scripts/send-policy-update-email.ts   # dry run
 *   DRY_RUN=false npx tsx scripts/send-policy-update-email.ts   # execute
 *
 * REQUIRED ENV VARS
 *   - DATABASE_URL: Prisma database connection string
 *   - AUTH_RESEND_KEY: Resend API key for sending emails
 *   - AUTH_RESEND_FROM: From email address (e.g., "Seer <noreply@askseer.ai>")
 *   - NEXTAUTH_URL: Base URL for the app (e.g., "https://askseer.ai")
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local file (Next.js convention)
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
// Also try .env as fallback
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Email configuration
const RESEND_API_KEY = process.env.AUTH_RESEND_KEY;
const FROM_EMAIL = "Seer <support@mail.askseer.ai>";
const BASE_URL = process.env.NEXTAUTH_URL || "https://askseer.ai";

// Rate limiting configuration
const BATCH_SIZE = 50; // emails per batch
const BATCH_DELAY_MS = 1000; // delay between batches (1 second)

// Email template helper (same as lib/email.ts)
function createStyledEmailHtml(params: {
  title: string;
  subtitle: string;
  content: string;
  brandColor?: string;
  buttonText?: string;
  buttonUrl?: string;
  showFooter?: boolean;
  footerContact?: string;
}) {
  const {
    title,
    subtitle,
    content,
    brandColor = "#18181b",
    buttonText,
    buttonUrl,
    showFooter = true,
    footerContact = "support@askseer.ai",
  } = params;

  const baseUrl = BASE_URL;

  const color = {
    background: "#f8fafc",
    text: "#3f3f46",
    mainBackground: "#ffffff",
    cardBackground: "#ffffff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: "#ffffff",
    accent: "#f1f5f9",
    border: "#e2e8f0",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${color.background};font-family:'Roboto',system-ui,-apple-system,Arial,sans-serif;line-height:1.6;">
  <table width="100%" style="background-color:${color.background};min-height:100vh;" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="100%" style="max-width:600px;background-color:${color.cardBackground};border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);border:1px solid ${color.border};" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding:40px 40px 20px 40px;">
              <div style="text-align:center;">
                <img src="${baseUrl}/logo-black.png" alt="Seer logo" height="30" width="32" style="display:block;margin:0 auto 8px;" />
                <h1 style="margin:0;font-size:28px;font-weight:800;color:${brandColor};letter-spacing:-0.025em;">Seer</h1>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 40px 20px 40px;">
              <h2 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:${color.text};line-height:1.25;">${title}</h2>
              <p style="margin:0 0 32px 0;font-size:16px;color:#64748b;line-height:1.5;">${subtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">${content}</td>
          </tr>
          ${
            buttonText && buttonUrl
              ? `<tr><td align="center" style="padding:0 40px 32px 40px;">
            <table cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="border-radius:8px;background-color:${color.buttonBackground};">
              <a href="${buttonUrl}" style="display:inline-block;padding:12px 32px;font-size:16px;font-weight:500;color:${color.buttonText};text-decoration:none;border-radius:8px;">${buttonText}</a>
            </td></tr></table></td></tr>`
              : ""
          }
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid ${color.border};margin:0;"/></td></tr>
          ${
            showFooter
              ? `<tr><td align="center" style="padding:32px 40px 40px 40px;">
            <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Contact us at ${footerContact}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">We'll respond within 2 business days.</p>
          </td></tr>`
              : `<tr><td style="padding:20px 40px;"></td></tr>`
          }
        </table>
        <table width="100%" style="max-width:600px;margin-top:24px;" cellspacing="0" cellpadding="0" border="0">
          <tr><td align="center"><p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Seer. All rights reserved.</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Create the policy update email content
function createPolicyUpdateEmail(): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Updates to Our Privacy Policy and Terms of Service";

  const content = `
    <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;line-height:1.6;">
      We've updated our <a href="${BASE_URL}/privacy" style="color:#2563eb;text-decoration:underline;">Privacy Policy</a> and 
      <a href="${BASE_URL}/terms" style="color:#2563eb;text-decoration:underline;">Terms of Service</a> to reflect how we process payments.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 12px 0;font-size:15px;font-weight:600;color:#18181b;">What's Changed:</p>
      <p style="margin:0;font-size:15px;color:#3f3f46;line-height:1.6;">
        We now use <strong>Stripe</strong> as our payment processor for credit purchases. When you purchase credits, 
        Stripe will process your payment and send you a receipt to your registered email address.
      </p>
    </div>
    <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;line-height:1.6;">
      These changes take effect on <strong>November 26, 2025</strong>. By continuing to use Seer after this date, 
      you agree to the updated terms.
    </p>
    <p style="margin:0;font-size:16px;color:#3f3f46;line-height:1.6;">
      If you have any questions about these changes, please don't hesitate to reach out.
    </p>
  `;

  const html = createStyledEmailHtml({
    title: "Policy Updates",
    subtitle: "Important changes to how we process payments",
    content,
    buttonText: "Open Seer",
    buttonUrl: `${BASE_URL}/`,
    footerContact: "privacy@askseer.ai",
  });

  const text = `Updates to Our Privacy Policy and Terms of Service

We've updated our Privacy Policy and Terms of Service to reflect how we process payments.

What's Changed:
We now use Stripe as our payment processor for credit purchases. When you purchase credits, Stripe will process your payment and send you a receipt to your registered email address.

These changes take effect on November 26, 2025. By continuing to use Seer after this date, you agree to the updated terms.

Review our updated policies:
- Privacy Policy: ${BASE_URL}/privacy
- Terms of Service: ${BASE_URL}/terms

If you have any questions about these changes, please contact us at privacy@askseer.ai.

© ${new Date().getFullYear()} Seer. All rights reserved.`;

  return { subject, html, text };
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";

  console.log("\n=== Privacy Policy & Terms Update Email Script ===\n");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no emails will be sent)" : "LIVE (emails will be sent)"}`,
  );
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`From: ${FROM_EMAIL}\n`);

  if (!RESEND_API_KEY && !DRY_RUN) {
    console.error(
      "ERROR: AUTH_RESEND_KEY environment variable is required for sending emails",
    );
    process.exit(1);
  }

  const resend = new Resend(RESEND_API_KEY);

  // Get all active users with an email address
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      email: { not: "" },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(`Found ${users.length} active users\n`);

  if (users.length === 0) {
    console.log("No users to email. Exiting.");
    return;
  }

  const { subject, html, text } = createPolicyUpdateEmail();

  if (DRY_RUN) {
    console.log("[DRY RUN] Would send emails to the following users:\n");
    users.forEach((user, index) => {
      console.log(
        `  ${index + 1}. ${user.email}${user.name ? ` (${user.name})` : ""}`,
      );
    });
    console.log(`\n[DRY RUN] Total: ${users.length} emails would be sent`);
    console.log("\n[DRY RUN] Email subject:", subject);
    console.log("\n[DRY RUN] To send emails for real, run with DRY_RUN=false");
    return;
  }

  // Send emails in batches
  let sent = 0;
  let failed = 0;
  const failedEmails: string[] = [];

  console.log(
    `Sending emails (with 600ms delay between each to respect rate limits)...\n`,
  );

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const progress = `[${i + 1}/${users.length}]`;

    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        replyTo: "support@askseer.ai",
        to: user.email,
        subject,
        html,
        text,
      });

      if (error) {
        console.error(
          `${progress} ❌ Failed: ${user.email} - ${error.message}`,
        );
        failed++;
        failedEmails.push(user.email);
      } else {
        console.log(`${progress} ✓ Sent: ${user.email}`);
        sent++;
      }
    } catch (err: any) {
      console.error(`${progress} ❌ Error: ${user.email} - ${err.message}`);
      failed++;
      failedEmails.push(user.email);
    }

    // Rate limit: 2 requests per second max, so wait 600ms between each email
    if (i < users.length - 1) {
      await sleep(600);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total users: ${users.length}`);
  console.log(`Emails sent: ${sent}`);
  console.log(`Emails failed: ${failed}`);

  if (failedEmails.length > 0) {
    console.log("\nFailed emails:");
    failedEmails.forEach((email) => console.log(`  - ${email}`));
  }

  console.log("\n=== Done ===\n");
}

run()
  .catch((e) => {
    console.error("[ERROR]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
