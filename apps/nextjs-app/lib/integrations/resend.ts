import { Resend } from "resend";

let resendClient: Resend | null = null;

const DEFAULT_SENDER_EMAIL = "onboarding@resend.dev";

export function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.AUTH_RESEND_KEY) {
      throw new Error("AUTH_RESEND_KEY environment variable is required");
    }
    resendClient = new Resend(process.env.AUTH_RESEND_KEY);
  }
  return resendClient;
}

export const getSenderEmail = () =>
  process.env.AUTH_RESEND_FROM || DEFAULT_SENDER_EMAIL;
