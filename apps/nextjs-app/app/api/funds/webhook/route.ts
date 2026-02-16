import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { logger } from "@/apps/shared/logger";
import { addTeamBalance } from "@/apps/nextjs-app/lib/db/data";

const stripeApiKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const crypto = require("crypto");

  const signedPayload = `${payload}`;
  const signatures = signature.split(",");

  let timestamp = "";
  let scheme = "";
  let signatureToVerify = "";

  for (const sig of signatures) {
    const [key, value] = sig.split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      scheme = "v1";
      signatureToVerify = value;
    }
  }

  if (!timestamp || !signatureToVerify) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${signedPayload}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signatureToVerify),
  );
}

/**
 * Stripe webhook handler for processing successful checkout sessions
 * This endpoint receives events from Stripe when payments are completed
 */
export async function POST(request: Request) {
  if (!stripeApiKey || !webhookSecret) {
    logger.error("Stripe configuration is missing", {
      hasApiKey: !!stripeApiKey,
      hasWebhookSecret: !!webhookSecret,
    });
    return NextResponse.json(
      { error: "Webhook handler not configured" },
      { status: 500 },
    );
  }

  // Get the raw body for signature verification
  const payload = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    logger.warn("Webhook request missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify the webhook signature
  try {
    const isValid = verifyStripeSignature(payload, signature, webhookSecret);
    if (!isValid) {
      logger.warn("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch (error) {
    logger.error("Error verifying webhook signature", { error });
    return NextResponse.json(
      { error: "Signature verification failed" },
      { status: 400 },
    );
  }

  // Parse the event
  let event: any;
  try {
    event = JSON.parse(payload);
  } catch (error) {
    logger.error("Failed to parse webhook payload", { error });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  logger.info("Received Stripe webhook event", {
    type: event.type,
    id: event.id,
  });

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Extract metadata from the session
    const teamId = session.metadata?.teamId;
    const purchasedByUserId = session.metadata?.purchasedByUserId;
    const amountCents = parseInt(session.metadata?.amountCents || "0", 10);

    logger.info("Processing completed checkout session", {
      sessionId: session.id,
      teamId,
      purchasedByUserId,
      amountCents,
      paymentStatus: session.payment_status,
    });

    // Validate that we have all required metadata
    if (!teamId || !purchasedByUserId || !amountCents || amountCents < 1) {
      logger.error("Checkout session missing required metadata", {
        sessionId: session.id,
        teamId,
        purchasedByUserId,
        amountCents,
      });
      return NextResponse.json(
        { error: "Invalid session metadata" },
        { status: 400 },
      );
    }

    // Only add balance if payment was successful
    if (session.payment_status === "paid") {
      try {
        await addTeamBalance({
          teamId,
          amountCents,
          byUserId: purchasedByUserId,
          reason: `stripe_purchase:${session.id}`,
        });

        logger.info("Successfully processed funding purchase", {
          sessionId: session.id,
          teamId,
          amountCents,
        });
      } catch (error) {
        logger.error("Failed to add balance after successful payment", {
          sessionId: session.id,
          teamId,
          amountCents,
          error,
        });
        // Return 500 so Stripe will retry the webhook
        return NextResponse.json(
          { error: "Failed to add balance" },
          { status: 500 },
        );
      }
    } else {
      logger.warn("Checkout session completed but payment not paid", {
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });
    }
  }

  // Return 200 to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
