/**
 * Test script for Stripe credit purchase webhook
 *
 * This script simulates a Stripe webhook event for testing the credit purchase flow.
 * It's useful for local development without needing to use the Stripe CLI.
 *
 * Usage:
 *   npm run test:webhook
 *
 * Or directly with ts-node:
 *   npx ts-node scripts/test-webhook.ts
 */

import crypto from "crypto";

const WEBHOOK_URL =
  process.env.WEBHOOK_URL || "http://localhost:3000/api/credits/webhook";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret";

// Sample checkout.session.completed event
const createTestEvent = (overrides: any = {}) => ({
  id: "evt_test_" + Date.now(),
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_" + Date.now(),
      object: "checkout.session",
      payment_status: "paid",
      metadata: {
        teamId: "team_123",
        purchasedByUserId: "user_456",
        credits: "100",
        ...overrides.metadata,
      },
      ...overrides,
    },
  },
  created: Math.floor(Date.now() / 1000),
});

// Generate Stripe signature
function generateStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function testWebhook(eventOverrides: any = {}) {
  const event = createTestEvent(eventOverrides);
  const payload = JSON.stringify(event);
  const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

  console.log("Testing webhook with event:", {
    type: event.type,
    sessionId: event.data.object.id,
    metadata: event.data.object.metadata,
  });

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    });

    const result = await response.json().catch(() => ({}));

    console.log("Webhook response:", {
      status: response.status,
      statusText: response.statusText,
      body: result,
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }

    console.log("✅ Webhook test passed!");
    return result;
  } catch (error) {
    console.error("❌ Webhook test failed:", error);
    throw error;
  }
}

// Run different test scenarios
async function runTests() {
  console.log("\n=== Testing Stripe Webhook ===\n");

  // Test 1: Successful payment
  console.log("Test 1: Successful payment with valid metadata");
  try {
    await testWebhook({
      metadata: {
        teamId: "team_test_123",
        purchasedByUserId: "user_test_456",
        credits: "50",
      },
    });
  } catch (error) {
    console.error("Test 1 failed");
  }

  console.log("\n---\n");

  // Test 2: Payment not completed
  console.log("Test 2: Payment not completed (unpaid status)");
  try {
    await testWebhook({
      payment_status: "unpaid",
      metadata: {
        teamId: "team_test_789",
        purchasedByUserId: "user_test_012",
        credits: "25",
      },
    });
  } catch (error) {
    console.error("Test 2 failed");
  }

  console.log("\n---\n");

  // Test 3: Missing metadata
  console.log("Test 3: Missing required metadata");
  try {
    await testWebhook({
      metadata: {
        teamId: "team_test_345",
        // Missing purchasedByUserId and credits
      },
    });
  } catch (error) {
    console.error("Test 3 expected to fail (and it did)");
  }
}

// Run tests if this is the main module
if (require.main === module) {
  runTests()
    .then(() => {
      console.log("\n=== All tests completed ===\n");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n=== Test suite failed ===\n", error);
      process.exit(1);
    });
}

export { testWebhook, createTestEvent, generateStripeSignature };
