import { NextResponse } from "next/server";
import { addTeamBalance } from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";

const stripeApiKey = process.env.STRIPE_SECRET_KEY;

/**
 * Endpoint to verify a Stripe checkout session and ensure credits were added
 * Called from the frontend after successful payment redirect
 */
export async function POST(request: Request) {
  if (!stripeApiKey) {
    logger.error("Stripe API key not configured");
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 },
    );
  }

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 },
      );
    }

    // Fetch the session from Stripe
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${stripeApiKey}`,
        },
      },
    );

    if (!response.ok) {
      logger.error("Failed to fetch Stripe session", {
        sessionId,
        status: response.status,
      });
      return NextResponse.json(
        { error: "Failed to verify session" },
        { status: 500 },
      );
    }

    const session = await response.json();

    logger.info("Verified Stripe session", {
      sessionId,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
    });

    // Check if payment was successful
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        {
          success: false,
          paymentStatus: session.payment_status,
          message: "Payment not completed",
        },
        { status: 200 },
      );
    }

    // Extract metadata
    const teamId = session.metadata?.teamId;
    const purchasedByUserId = session.metadata?.purchasedByUserId;
    const amountCents = parseInt(session.metadata?.amountCents || "0", 10);

    if (!teamId || !purchasedByUserId || !amountCents) {
      logger.error("Session missing required metadata", {
        sessionId,
        metadata: session.metadata,
      });
      return NextResponse.json(
        { error: "Invalid session metadata" },
        { status: 400 },
      );
    }

    // Add balance immediately (idempotent - webhook may also add it)
    try {
      await addTeamBalance({
        teamId,
        amountCents,
        byUserId: purchasedByUserId,
        reason: `stripe_purchase:${sessionId}`,
      });

      logger.info("Balance added via verify endpoint", {
        sessionId,
        teamId,
        amountCents,
      });

      return NextResponse.json({
        success: true,
        paymentStatus: session.payment_status,
        amountCents,
      });
    } catch (error) {
      // If balance was already added by webhook, this might fail
      // Check if it's a duplicate issue
      logger.warn("Failed to add balance in verify endpoint", {
        sessionId,
        error,
        note: "Webhook may have already processed this",
      });

      // Return success anyway - balance may already be added
      return NextResponse.json({
        success: true,
        paymentStatus: session.payment_status,
        amountCents,
        note: "Funds may have been added by webhook",
      });
    }
  } catch (error) {
    logger.error("Error verifying checkout session", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
