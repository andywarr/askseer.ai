/*
 * Script: Activate or Reject a Pending Company Claim
 *
 * PURPOSE
 *   - Activate a company that was claimed via the claim dialog
 *   - Or reject a pending claim
 *
 * USAGE
 *   # Activate a company
 *   npm run script:activate-company -- --company-id <companyId>
 *
 *   # Reject a company
 *   npm run script:activate-company -- --company-id <companyId> --reject
 *
 *   # With optional reviewed-by user id
 *   npm run script:activate-company -- --company-id <companyId> --reviewed-by <userId>
 *
 * ENVIRONMENT VARIABLES
 *   DATABASE_URL       Required - Prisma database connection
 *   RESEND_API_KEY     Optional - For sending activation email
 *   RESEND_FROM        Optional - Email sender address
 */
import * as dotenv from "dotenv";
dotenv.config();

import {
  dbActivateCompany,
  dbRejectCompany,
} from "../src/services/databaseService";
import prisma from "../src/services/db";

// Parse command line arguments
function parseArgs(): {
  companyId: string;
  reject: boolean;
  reviewedByUserId?: string;
} {
  const args = process.argv.slice(2);

  let companyId: string | undefined;
  let reject = false;
  let reviewedByUserId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--company-id" && args[i + 1]) {
      companyId = args[i + 1];
      i++;
    } else if (arg === "--reject") {
      reject = true;
    } else if (arg === "--reviewed-by" && args[i + 1]) {
      reviewedByUserId = args[i + 1];
      i++;
    }
  }

  if (!companyId) {
    console.error("Error: --company-id is required");
    console.error(
      "\nUsage: npm run script:activate-company -- --company-id <id> [--reject] [--reviewed-by <userId>]"
    );
    process.exit(1);
  }

  return { companyId, reject, reviewedByUserId };
}

async function sendActivationEmail(
  companyId: string,
  claimingUserId: string,
  companyName: string
) {
  try {
    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: claimingUserId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      console.log("[EMAIL] No user email found, skipping notification");
      return;
    }

    // Check for Resend API key
    const apiKey = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      console.log(
        "[EMAIL] No RESEND_API_KEY found, skipping email notification"
      );
      return;
    }

    const from =
      process.env.RESEND_FROM ||
      process.env.AUTH_RESEND_FROM ||
      "support@askseer.ai";

    const baseUrl = process.env.NEXTAUTH_URL || "https://askseer.ai";
    const brandColor = "#18181b";

    // Styled email matching other Seer emails
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Company Activated</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Roboto',system-ui,-apple-system,Arial,sans-serif;line-height:1.6;">
  <table width="100%" style="background-color:#f8fafc;min-height:100vh;" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);border:1px solid #e2e8f0;" cellspacing="0" cellpadding="0" border="0">
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
              <h2 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:#3f3f46;line-height:1.25;">🎉 Your company is now active!</h2>
              <p style="margin:0 0 32px 0;font-size:16px;color:#64748b;line-height:1.5;">Your company "${companyName}" has been verified and activated on Seer.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <p style="margin:0 0 16px 0;font-size:16px;color:#3f3f46;">Great news! We've verified your company and it's now fully active. You can now:</p>
              <ul style="margin:0 0 24px 0;padding-left:24px;color:#3f3f46;">
                <li style="margin-bottom:8px;font-size:16px;">Invite team members to your company</li>
                <li style="margin-bottom:8px;font-size:16px;">Create teams and manage permissions</li>
                <li style="margin-bottom:8px;font-size:16px;">Run studies under your company umbrella</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <table cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:${brandColor};">
                    <a href="${baseUrl}/studies" style="display:inline-block;padding:12px 32px;font-size:16px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:8px;">Get Started</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"/></td></tr>
          <tr>
            <td align="center" style="padding:32px 40px 40px 40px;">
              <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Contact us at support@askseer.ai</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">We'll respond within 2 business days.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width:600px;margin-top:24px;" cellspacing="0" cellpadding="0" border="0">
          <tr><td align="center"><p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Seer. All rights reserved.</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: user.email,
        subject: `Your company "${companyName}" has been activated on Seer`,
        html,
        text: `Hi ${user.name || "there"},\n\nGreat news! Your company "${companyName}" has been verified and activated on Seer.\n\nYou can now:\n- Invite team members to your company\n- Create teams and manage permissions\n- Run studies under your company umbrella\n\nGet started at: ${baseUrl}/studies\n\nQuestions? Contact us at support@askseer.ai\n\n© ${new Date().getFullYear()} Seer. All rights reserved.`,
      }),
    });

    if (res.ok) {
      console.log(`[EMAIL] Activation email sent to ${user.email}`);
    } else {
      const body = await res.text();
      console.error(`[EMAIL] Failed to send email: ${res.status} ${body}`);
    }
  } catch (error) {
    console.error("[EMAIL] Error sending activation email:", error);
  }
}


async function run() {
  const { companyId, reject, reviewedByUserId } = parseArgs();

  console.log("\n=== Company Activation Script ===");
  console.log(`Company ID: ${companyId}`);
  console.log(`Action: ${reject ? "REJECT" : "ACTIVATE"}`);
  if (reviewedByUserId) {
    console.log(`Reviewed by: ${reviewedByUserId}`);
  }
  console.log("");

  // First, fetch company details to show what we're working with
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      domains: true,
      memberships: {
        where: { role: "OWNER" },
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  if (!company) {
    console.error(`Error: Company not found with ID: ${companyId}`);
    process.exit(1);
  }

  console.log(`Company Name: ${company.name}`);
  console.log(`Current Status: ${company.status}`);
  console.log(`Domain(s): ${company.domains.map((d) => d.domain).join(", ")}`);
  console.log(
    `Owner(s): ${company.memberships.map((m) => m.user?.email || m.userId).join(", ")}`
  );
  console.log("");

  if (company.status !== "PENDING") {
    console.error(
      `Error: Company is already ${company.status.toLowerCase()}. Cannot ${reject ? "reject" : "activate"}.`
    );
    process.exit(1);
  }

  try {
    if (reject) {
      console.log("Rejecting company claim...");
      const result = await dbRejectCompany({
        companyId,
        reviewedByUserId,
      });
      console.log("\n✓ Company claim rejected successfully");
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Activating company...");
      const result = await dbActivateCompany({
        companyId,
        reviewedByUserId,
      });
      console.log("\n✓ Company activated successfully");
      console.log(JSON.stringify(result, null, 2));

      // Send activation email
      if (result.claimingUserId && result.company?.name) {
        await sendActivationEmail(
          companyId,
          result.claimingUserId,
          result.company.name
        );
      }
    }
  } catch (error: any) {
    console.error(`\n✗ Failed to ${reject ? "reject" : "activate"} company:`);
    console.error(error?.message || error);
    process.exit(1);
  }
}

run()
  .catch((e) => {
    console.error("[FATAL] Script aborted:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
