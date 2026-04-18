/**
 * Email template utilities and HTML generators.
 * Centralizes all email HTML generation for consistency and maintainability.
 */

// ==========================================
// Helper Functions
// ==========================================

/**
 * Format form value to display label (e.g., "data_science" -> "Data science")
 */
export function formatFormValue(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// ==========================================
// Base Email Template
// ==========================================

export interface StyledEmailParams {
  title: string;
  subtitle: string;
  content: string;
  brandColor?: string;
  buttonText?: string;
  buttonUrl?: string;
  showFooter?: boolean;
  footerContact?: string;
}

/**
 * Creates a fully styled HTML email with the Seer branding.
 * This is the base template used by all outgoing emails.
 */
export function createStyledEmailHtml(params: StyledEmailParams): string {
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

  const baseUrl = process.env.NEXTAUTH_URL || "https://askseer.ai";

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

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${color.background}; font-family: 'Roboto', system-ui, -apple-system, Arial, sans-serif; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${color.background}; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 20px 20px;">
        <!-- Main container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: ${color.cardBackground}; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid ${color.border};">
          <!-- Header with logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <div style="text-align:center;">
                <img src="${baseUrl}/logo-black.png" alt="Seer logo" height="30" width="32" style="display:block;margin:0 auto 8px;" />
                <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: ${brandColor}; letter-spacing: -0.025em;">Seer</h1>
              </div>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td align="center" style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: ${color.text}; line-height: 1.25;">
                ${title}
              </h2>
              <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; line-height: 1.5;">
                ${subtitle}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              ${content}
            </td>
          </tr>
          
          ${
            buttonText && buttonUrl
              ? `
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 32px 40px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: ${color.buttonBackground}; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                    <a href="${buttonUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 500; color: ${color.buttonText}; text-decoration: none; border-radius: 8px; transition: all 0.2s ease;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ""
          }
          
          ${
            showFooter
              ? `
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid ${color.border}; margin: 0;">
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 40px 40px 40px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                Questions? Contact us at ${footerContact}
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                We'll respond within 1 business day.
              </p>
            </td>
          </tr>
          `
              : `
          <!-- Minimal footer spacing -->
          <tr>
            <td style="padding: 20px 40px;">
            </td>
          </tr>
          `
          }
        </table>
        
        <!-- Footer text outside card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                © ${new Date().getFullYear()} Seer. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ==========================================
// Reusable Email Content Components
// ==========================================

/**
 * Generates HTML content for the contact details section of emails.
 */
export function generateContactDetailsHtml(params: {
  name: string;
  email: string;
  phone: string;
  company: string;
  jobRole: string;
}): string {
  return `
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Contact Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">Name:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Email:</td>
          <td style="padding: 12px 0; color: #64748b;"><a href="mailto:${params.email}" style="color: #18181b; text-decoration: none;">${params.email}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Phone:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.phone}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Company:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.company}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Job Role:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.jobRole}</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Generates HTML for the "how did you hear about us" section.
 */
export function generateHowDidYouHearHtml(howDidYouHear: string): string {
  return `
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Additional Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">How they heard about us:</td>
          <td style="padding: 12px 0; color: #64748b;">${howDidYouHear}</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Generates HTML for a content section (use case or message).
 */
export function generateContentSectionHtml(
  title: string,
  content: string,
): string {
  return `
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">${title}</h3>
      <p style="margin: 0; color: #64748b; line-height: 1.6; white-space: pre-wrap;">${content}</p>
    </div>
  `;
}

/**
 * Generates HTML for action required alert box.
 */
export function generateActionRequiredHtml(text: string): string {
  return `
    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; color: #92400e; font-weight: 500;">${text}</p>
    </div>
  `;
}

/**
 * Generates confirmation email content for the user who submitted a form.
 */
export function generateConfirmationEmailHtml(params: {
  name: string;
  email: string;
  company: string;
  jobRole: string;
  content: string;
  contentTitle: string;
  thankYouMessage: string;
  contactEmail: string;
}): string {
  return `
    <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
      Hi ${params.name},
    </p>
    
    <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
      ${params.thankYouMessage}
    </p>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Your Request Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 40%;">Name:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Email:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.email}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Company:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.company}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Job Role:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.jobRole}</td>
        </tr>
      </table>
    </div>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Your ${params.contentTitle}</h3>
      <p style="margin: 0; color: #64748b; line-height: 1.6; white-space: pre-wrap;">${params.content}</p>
    </div>
    
    <p style="margin: 24px 0 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
      In the meantime, feel free to explore our platform by 
      <a href="https://askseer.ai/signin" style="color: #18181b; text-decoration: none; font-weight: 500;">signing up for free</a>.
    </p>
    
    <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
      If you have any questions, please don't hesitate to reach out to us at 
      <a href="mailto:${params.contactEmail}" style="color: #18181b; text-decoration: none; font-weight: 500;">${params.contactEmail}</a>
    </p>
  `;
}

// ==========================================
// Long Flow Alert Email
// ==========================================

export interface LongFlowAlertParams {
  screenCount: number;
  warningThreshold: number;
  studyName: string;
  studyType: string;
  studyId: string;
  userName: string | null;
  userEmail: string;
  teamName: string | null;
  companyName: string | null;
}

/**
 * Generates HTML content for the long flow alert email.
 */
export function generateLongFlowAlertHtml(params: LongFlowAlertParams): string {
  const studyTypeLabel =
    params.studyType === "heuristic_evaluation"
      ? "Heuristic Evaluation"
      : "Cognitive Walkthrough";

  return `
      <div style="background:#fef3c7;border:1px solid #f59e0b;padding:16px;margin-bottom:16px;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#92400e;font-weight:500;">
          A user has submitted a study with <strong>${params.screenCount} screens</strong>, 
          exceeding the ${params.warningThreshold} screen threshold.
        </p>
      </div>
      <div style="background:#f8fafc;padding:24px;border-radius:8px;border:1px solid #e2e8f0;">
        <h3 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#3f3f46;">Study Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;width:35%;">Study Name</td>
            <td style="padding:8px 0;color:#64748b;">${params.studyName}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Study Type</td>
            <td style="padding:8px 0;color:#64748b;">${studyTypeLabel}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Screen Count</td>
            <td style="padding:8px 0;color:#c2410c;font-weight:600;">${params.screenCount}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">User</td>
            <td style="padding:8px 0;color:#64748b;">${params.userName || "(no name)"} &lt;${params.userEmail}&gt;</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Team</td>
            <td style="padding:8px 0;color:#64748b;">${params.teamName || "(no team)"}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Company</td>
            <td style="padding:8px 0;color:#64748b;">${params.companyName || "(no company)"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Study ID</td>
            <td style="padding:8px 0;color:#64748b;font-family:monospace;font-size:12px;">${params.studyId}</td>
          </tr>
        </table>
      </div>`;
}

/**
 * Generates plain text content for the long flow alert email.
 */
export function generateLongFlowAlertText(params: LongFlowAlertParams): string {
  return `Long Flow Alert

A user has submitted a study with ${params.screenCount} screens.

Study: ${params.studyName}
Type: ${params.studyType}
User: ${params.userName || "(no name)"} <${params.userEmail}>
Team: ${params.teamName || "(no team)"}
Company: ${params.companyName || "(no company)"}
Study ID: ${params.studyId}`;
}

// ==========================================
// Plain Text Email Templates
// ==========================================

export interface InternalNotificationTextParams {
  title: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  jobRole: string;
  howDidYouHear: string;
  contentSectionTitle: string;
  content: string;
  actionRequiredText: string;
}

/**
 * Generates plain text content for internal notification emails (demo/contact requests).
 */
export function generateInternalNotificationText(
  params: InternalNotificationTextParams,
): string {
  return `${params.title}

Contact Details:
Name: ${params.name}
Email: ${params.email}
Phone: ${params.phone}
Company: ${params.company}
Job Role: ${params.jobRole}

How they heard about us: ${params.howDidYouHear}

${params.contentSectionTitle}:
${params.content}

${params.actionRequiredText}`;
}

export interface ConfirmationEmailTextParams {
  title: string;
  name: string;
  email: string;
  company: string;
  jobRole: string;
  contentSectionTitle: string;
  content: string;
  thankYouMessage: string;
  contactEmail: string;
  signUpUrl: string;
}

/**
 * Generates plain text content for confirmation emails sent to users.
 */
export function generateConfirmationEmailText(
  params: ConfirmationEmailTextParams,
): string {
  return `${params.title}

Hi ${params.name},

${params.thankYouMessage}

Your Request Summary:
Name: ${params.name}
Email: ${params.email}
Company: ${params.company}
Job Role: ${params.jobRole}

Your ${params.contentSectionTitle}:
${params.content}

In the meantime, feel free to explore our platform by signing up for free at ${params.signUpUrl}

If you have any questions, please don't hesitate to reach out to us at ${params.contactEmail}

The Seer Team`;
}

// ==========================================
// Weekly Stats Email Templates
// ==========================================

export interface WeeklyStatsParams {
  startDate: string;
  endDate: string;
  newStudies: number;
  newUsers: number;
  newTeams: number;
  newCompanies: number;
}

/**
 * Generates HTML content for the weekly usage stats email.
 */
export function generateWeeklyStatsHtml(params: WeeklyStatsParams): string {
  return `
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Usage Stats Overview</h3>
      <p style="margin: 0 0 16px 0; color: #64748b;">
        Here are the key platform metrics for the period of <strong>${params.startDate}</strong> to <strong>${params.endDate}</strong>:
      </p>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 70%;">New Studies Run</td>
          <td style="padding: 12px 0; color: #2563eb; font-weight: 600; font-size: 18px; text-align: right;">${params.newStudies}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">New Users Registered</td>
          <td style="padding: 12px 0; color: #2563eb; font-weight: 600; font-size: 18px; text-align: right;">${params.newUsers}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">New Teams Created</td>
          <td style="padding: 12px 0; color: #2563eb; font-weight: 600; font-size: 18px; text-align: right;">${params.newTeams}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">New Companies Registered</td>
          <td style="padding: 12px 0; color: #2563eb; font-weight: 600; font-size: 18px; text-align: right;">${params.newCompanies}</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Generates plain text content for the weekly usage stats email.
 */
export function generateWeeklyStatsText(params: WeeklyStatsParams): string {
  return `Weekly Usage Stats Overview

Here are the key platform metrics for the period of ${params.startDate} to ${params.endDate}:

- New Studies Run: ${params.newStudies}
- New Users Registered: ${params.newUsers}
- New Teams Created: ${params.newTeams}
- New Companies Registered: ${params.newCompanies}

© ${new Date().getFullYear()} Seer. All rights reserved.`;
}
