"use server";

import { z } from "zod";
import { Resend } from "resend";

import { logger } from "@/apps/shared/logger";
import { LONG_FLOW_WARNING_THRESHOLD } from "@/apps/nextjs-app/lib/utils/constants";
import {
  formatFormValue,
  createStyledEmailHtml,
  generateContactDetailsHtml,
  generateHowDidYouHearHtml,
  generateContentSectionHtml,
  generateActionRequiredHtml,
  generateConfirmationEmailHtml,
  generateLongFlowAlertHtml,
  generateLongFlowAlertText,
  generateInternalNotificationText,
  generateConfirmationEmailText,
} from "@/apps/nextjs-app/lib/integrations/email-templates";
import {
  actionSuccess,
  actionError,
  validationError,
  ValidationResult,
} from "@/apps/nextjs-app/lib/actions/shared";

// ==========================================
// Types & Interfaces
// ==========================================

/** Configuration for a contact form submission type */
interface ContactFormConfig {
  /** The type of request (used in logging) */
  requestType: "demo" | "contact";
  /** Field name for the user's message/use case content */
  contentFieldName: "useCase" | "message";
  /** Email address to send internal notifications to */
  internalEmail: string;
  /** Email subject prefix */
  subjectPrefix: string;
  /** Title for internal email */
  internalEmailTitle: string;
  /** Subtitle for internal email */
  internalEmailSubtitle: string;
  /** Title for confirmation email to user */
  confirmationEmailTitle: string;
  /** Subtitle for confirmation email to user */
  confirmationEmailSubtitle: string;
  /** Subject for confirmation email */
  confirmationEmailSubject: string;
  /** Thank you message for confirmation email */
  thankYouMessage: string;
  /** Action required text for internal email */
  actionRequiredText: string;
  /** Content section title (e.g., "Use Case" or "Message") */
  contentSectionTitle: string;
}

/** Success response data for contact form submissions */
export interface ContactFormSuccessData {
  message: string;
  emailId?: string;
  confirmationEmailId?: string;
}

/** Parameters for the long flow alert email */
export interface LongFlowAlertParams {
  userId: string;
  userEmail: string;
  userName: string | null;
  teamId: string | null;
  teamName: string | null;
  companyName: string | null;
  studyId: string;
  studyName: string;
  studyType: string;
  screenCount: number;
}

// ==========================================
// Resend Client Singleton
// ==========================================

let resendClient: Resend | null = null;

/**
 * Get the cached Resend client instance.
 * Creates a new instance on first call, then returns the cached instance.
 */
export function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.AUTH_RESEND_KEY) {
      throw new Error("AUTH_RESEND_KEY environment variable is required");
    }
    resendClient = new Resend(process.env.AUTH_RESEND_KEY);
  }
  return resendClient;
}

// ==========================================
// Email Configuration Constants
// ==========================================

// Default sender email (fallback when AUTH_RESEND_FROM not set)
const DEFAULT_SENDER_EMAIL = "onboarding@resend.dev";

/**
 * Get the sender email address from environment or fallback to default.
 */
export const getSenderEmail = () =>
  process.env.AUTH_RESEND_FROM || DEFAULT_SENDER_EMAIL;

// Internal notification email addresses
const DEMO_REQUEST_EMAIL = "demo@askseer.ai";
const CONTACT_REQUEST_EMAIL = "contact@askseer.ai";
const ALERT_EMAIL = "alert@askseer.ai";

// Standard response time commitment
const RESPONSE_TIME_DAYS = "1 business day";

// Base application URL
const APP_BASE_URL = "https://askseer.ai";

// ==========================================
// Contact Form Schema & Config
// ==========================================

/** Base schema for contact form fields shared between demo and contact requests */
const baseContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone number is required"),
  company: z.string().min(1, "Company is required"),
  jobRole: z.string().min(1, "Job role is required"),
  howDidYouHear: z.string().min(1, "Please let us know how you heard about us"),
});

const DEMO_FORM_CONFIG: ContactFormConfig = {
  requestType: "demo",
  contentFieldName: "useCase",
  internalEmail: DEMO_REQUEST_EMAIL,
  subjectPrefix: "Demo Request",
  internalEmailTitle: "New Demo Request",
  internalEmailSubtitle: "A potential customer has requested a product demo.",
  confirmationEmailTitle: "Demo Request Received",
  confirmationEmailSubtitle:
    "We'll be in touch soon to schedule your personalized demo.",
  confirmationEmailSubject: "Thanks for requesting a Seer demo!",
  thankYouMessage: `Thank you for your interest in Seer! We've received your demo request and a member of our team will be in touch within ${RESPONSE_TIME_DAYS} to schedule a personalized demo.`,
  actionRequiredText: `Action Required: Please follow up with the prospect within ${RESPONSE_TIME_DAYS} to schedule a demo.`,
  contentSectionTitle: "Use Case",
};

const CONTACT_FORM_CONFIG: ContactFormConfig = {
  requestType: "contact",
  contentFieldName: "message",
  internalEmail: CONTACT_REQUEST_EMAIL,
  subjectPrefix: "Contact Request",
  internalEmailTitle: "New Contact Request",
  internalEmailSubtitle: "Someone has reached out through the contact form.",
  confirmationEmailTitle: "Message Received",
  confirmationEmailSubtitle: "We'll be in touch soon with a response.",
  confirmationEmailSubject: "We've received your message - Seer",
  thankYouMessage: `Thank you for reaching out to Seer! We've received your message and a member of our team will respond within ${RESPONSE_TIME_DAYS}.`,
  actionRequiredText: `Action Required: Please respond to this inquiry within ${RESPONSE_TIME_DAYS}.`,
  contentSectionTitle: "Message",
};

// ==========================================
// Private Helper Functions
// ==========================================

/**
 * Core handler for contact form submissions (demo requests and contact requests).
 * Validates input, sends internal notification email, and sends confirmation to user.
 */
async function handleContactFormSubmission(
  formData: FormData,
  config: ContactFormConfig,
): Promise<ValidationResult<ContactFormSuccessData>> {
  const resend = getResendClient();

  // Extract common form fields
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const company = formData.get("company") as string;
  const jobRole = formData.get("jobRole") as string;
  const howDidYouHear = formData.get("howDidYouHear") as string;
  const content = formData.get(config.contentFieldName) as string;

  logger.debug(`Processing ${config.requestType} request`, {
    name,
    email,
    company,
    jobRole,
  });

  // Build schema with content field
  const schema = baseContactSchema.extend({
    [config.contentFieldName]: z
      .string()
      .min(1, `Please provide your ${config.contentFieldName}`),
  });

  try {
    // Validate the form data
    const validation = schema.safeParse({
      name,
      email,
      phone,
      company,
      jobRole,
      howDidYouHear,
      [config.contentFieldName]: content,
    });

    if (!validation.success) {
      logger.warn(`${config.requestType} request validation failed`, {
        name,
        email,
        errors: validation.error.errors,
      });
      return validationError("Invalid form data", validation.error.errors);
    }

    const validData = validation.data;
    const jobRoleLabel = formatFormValue(validData.jobRole);
    const howDidYouHearLabel = formatFormValue(validData.howDidYouHear);
    const validContent = validData[config.contentFieldName] as string;

    logger.info(`Processing ${config.requestType} request`, {
      name: validData.name,
      email: validData.email,
      company: validData.company,
      jobRole: validData.jobRole,
    });

    // Build internal email content
    const internalEmailContent =
      generateContactDetailsHtml({
        name: validData.name,
        email: validData.email,
        phone: validData.phone,
        company: validData.company,
        jobRole: jobRoleLabel,
      }) +
      generateHowDidYouHearHtml(howDidYouHearLabel) +
      generateContentSectionHtml(config.contentSectionTitle, validContent) +
      generateActionRequiredHtml(config.actionRequiredText);

    // Build confirmation email content
    const confirmationContent = generateConfirmationEmailHtml({
      name: validData.name,
      email: validData.email,
      company: validData.company,
      jobRole: jobRoleLabel,
      content: validContent,
      contentTitle: config.contentSectionTitle,
      thankYouMessage: config.thankYouMessage,
      contactEmail: config.internalEmail,
    });

    // Send both emails in parallel using Promise.allSettled
    const [internalResult, confirmationResult] = await Promise.allSettled([
      // Internal notification email
      resend.emails.send({
        from: getSenderEmail(),
        to: [config.internalEmail],
        subject: `${config.subjectPrefix} - ${validData.name} at ${validData.company}`,
        html: createStyledEmailHtml({
          title: config.internalEmailTitle,
          subtitle: config.internalEmailSubtitle,
          content: internalEmailContent,
          showFooter: false,
        }),
        text: generateInternalNotificationText({
          title: config.internalEmailTitle,
          name: validData.name,
          email: validData.email,
          phone: validData.phone,
          company: validData.company,
          jobRole: jobRoleLabel,
          howDidYouHear: howDidYouHearLabel,
          contentSectionTitle: config.contentSectionTitle,
          content: validContent,
          actionRequiredText: config.actionRequiredText,
        }),
      }),
      // Confirmation email to user
      resend.emails.send({
        from: getSenderEmail(),
        to: [validData.email],
        subject: config.confirmationEmailSubject,
        html: createStyledEmailHtml({
          title: config.confirmationEmailTitle,
          subtitle: config.confirmationEmailSubtitle,
          content: confirmationContent,
          footerContact: config.internalEmail,
        }),
        text: generateConfirmationEmailText({
          title: config.confirmationEmailTitle,
          name: validData.name,
          email: validData.email,
          company: validData.company,
          jobRole: jobRoleLabel,
          contentSectionTitle: config.contentSectionTitle,
          content: validContent,
          thankYouMessage: config.thankYouMessage,
          contactEmail: config.internalEmail,
          signUpUrl: `${APP_BASE_URL}/signin`,
        }),
      }),
    ]);

    // Process internal email result
    let internalEmailId: string | undefined;
    if (internalResult.status === "rejected") {
      logger.error(`Failed to send ${config.requestType} request email`, {
        name: validData.name,
        email: validData.email,
        company: validData.company,
        error: internalResult.reason?.message || String(internalResult.reason),
      });
      return actionError("Failed to send email");
    } else if (internalResult.value.error) {
      logger.error(`Failed to send ${config.requestType} request email`, {
        name: validData.name,
        email: validData.email,
        company: validData.company,
        error: internalResult.value.error.message,
      });
      return actionError("Failed to send email");
    } else {
      internalEmailId = internalResult.value.data?.id;
      logger.info(`${config.requestType} request email sent`, {
        name: validData.name,
        email: validData.email,
        company: validData.company,
        emailId: internalEmailId,
      });
    }

    // Process confirmation email result
    let confirmationEmailId: string | undefined;
    if (confirmationResult.status === "rejected") {
      logger.error(`Failed to send ${config.requestType} confirmation email`, {
        name: validData.name,
        email: validData.email,
        error:
          confirmationResult.reason?.message ||
          String(confirmationResult.reason),
      });
      // Don't fail the entire request if confirmation email fails
    } else if (confirmationResult.value.error) {
      logger.error(`Failed to send ${config.requestType} confirmation email`, {
        name: validData.name,
        email: validData.email,
        error: confirmationResult.value.error.message,
      });
      // Don't fail the entire request if confirmation email fails
    } else {
      confirmationEmailId = confirmationResult.value.data?.id;
      logger.info(`${config.requestType} confirmation email sent`, {
        name: validData.name,
        email: validData.email,
        confirmationEmailId,
      });
    }

    logger.info(`${config.requestType} request submitted successfully`, {
      name: validData.name,
      email: validData.email,
      company: validData.company,
      emailId: internalEmailId,
      confirmationEmailId,
    });

    return actionSuccess({
      message: `${config.requestType.charAt(0).toUpperCase() + config.requestType.slice(1)} request submitted successfully`,
      emailId: internalEmailId,
      confirmationEmailId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`Error processing ${config.requestType} request`, {
      name,
      email,
      company,
      error: errorMessage,
      stack: errorStack,
    });
    return actionError("Internal server error");
  }
}

// ==========================================
// Public Server Actions
// ==========================================

/** Submit a demo request form */
export async function submitDemoRequest(
  formData: FormData,
): Promise<ValidationResult<ContactFormSuccessData>> {
  return handleContactFormSubmission(formData, DEMO_FORM_CONFIG);
}

/** Submit a contact request form */
export async function submitContactRequest(
  formData: FormData,
): Promise<ValidationResult<ContactFormSuccessData>> {
  return handleContactFormSubmission(formData, CONTACT_FORM_CONFIG);
}

/**
 * Send an email alert when a user runs a study with more screens than the warning threshold.
 * This is a fire-and-forget operation that logs errors but doesn't block the study.
 */
export async function sendLongFlowAlert(
  params: LongFlowAlertParams,
): Promise<void> {
  try {
    const resend = getResendClient();
    const content = generateLongFlowAlertHtml({
      screenCount: params.screenCount,
      warningThreshold: LONG_FLOW_WARNING_THRESHOLD,
      studyName: params.studyName,
      studyType: params.studyType,
      studyId: params.studyId,
      userName: params.userName,
      userEmail: params.userEmail,
      teamName: params.teamName,
      companyName: params.companyName,
    });

    await resend.emails.send({
      from: getSenderEmail(),
      to: [ALERT_EMAIL],
      subject: `Long Flow Alert: ${params.screenCount} screens - ${params.studyName}`,
      html: createStyledEmailHtml({
        title: "Long Flow Study Submitted",
        subtitle: `A study with ${params.screenCount} screens has been submitted.`,
        content,
        showFooter: false,
      }),
      text: generateLongFlowAlertText({
        screenCount: params.screenCount,
        warningThreshold: LONG_FLOW_WARNING_THRESHOLD,
        studyName: params.studyName,
        studyType: params.studyType,
        studyId: params.studyId,
        userName: params.userName,
        userEmail: params.userEmail,
        teamName: params.teamName,
        companyName: params.companyName,
      }),
    });

    logger.info("Long flow alert email sent", {
      studyId: params.studyId,
      screenCount: params.screenCount,
      userId: params.userId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to send long flow alert email", {
      studyId: params.studyId,
      screenCount: params.screenCount,
      userId: params.userId,
      error: errorMessage,
    });
  }
}
