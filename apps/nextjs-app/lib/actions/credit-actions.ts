"use server";

import { logger } from "@/apps/shared/logger";
import { revalidatePath } from "next/cache";
import prisma from "@/apps/nextjs-app/lib/db";
import {
  requireAuth,
  actionSuccess,
  actionError,
  ActionResult,
} from "@/apps/nextjs-app/lib/actions/shared";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getUserTeams,
  addTeamCredits,
} from "@/apps/nextjs-app/lib/data";
import {
  PERSONAL_CREDIT_PRICE,
  COMPANY_CREDIT_PRICE,
} from "@/apps/shared/constants";

const stripeApiKey = process.env.STRIPE_SECRET_KEY;

interface TransferCreditsParams {
  fromTeamId: string;
  toTeamId: string;
  credits: number;
}

const MAX_CREDITS_PER_TRANSFER = 10000;

export async function transferCredits(
  params: TransferCreditsParams,
): Promise<ActionResult> {
  const { fromTeamId, toTeamId, credits } = params;

  // Validate inputs
  if (!fromTeamId || !toTeamId) {
    return actionError("Please select both teams.");
  }

  if (fromTeamId === toTeamId) {
    return actionError("Cannot transfer credits to the same team.");
  }

  if (!Number.isFinite(credits) || credits < 1) {
    return actionError("Enter at least 1 credit to transfer.");
  }

  if (credits > MAX_CREDITS_PER_TRANSFER) {
    return actionError(
      `Cannot transfer more than ${MAX_CREDITS_PER_TRANSFER} credits at once.`,
    );
  }

  try {
    const user = await requireAuth();
    const userId = user.id;

    // Gather allowed teams based on user permissions
    const allowedTeamIds = new Set<string>();
    let isCompanyAdmin = false;

    const domainInfo = await getCompanyByMyDomain();
    const userTeams = await getUserTeams(userId);

    if (domainInfo?.company) {
      // User is part of a company
      const members = await getCompanyMembers(domainInfo.company.id);
      const me = members.find((member) => member.userId === userId);

      if (!me || me.status === "DEACTIVATED") {
        return actionError("Access denied.");
      }

      const myRole = String(me.role || "").toUpperCase();
      isCompanyAdmin = myRole === "ADMIN" || myRole === "OWNER";

      const companyTeams = await getCompanyTeams(domainInfo.company.id);

      companyTeams.forEach((team: any) => {
        const membershipRole = String(
          team?.members?.find((m: any) => m.userId === userId)?.role || "",
        ).toUpperCase();

        // Company admins can transfer between any teams (including personal if enabled)
        if (isCompanyAdmin) {
          allowedTeamIds.add(team.id);
        } else if (
          !team.isPersonal &&
          (membershipRole === "ADMIN" || membershipRole === "OWNER")
        ) {
          // Team admins can only transfer between non-personal teams they admin
          allowedTeamIds.add(team.id);
        }
      });
    } else {
      // User not part of a company - cannot transfer
      return actionError(
        "Credit transfers are only available for company members.",
      );
    }

    // Verify both teams are in the allowed set
    if (!allowedTeamIds.has(fromTeamId)) {
      return actionError(
        "You do not have permission to transfer credits from this team.",
      );
    }

    if (!allowedTeamIds.has(toTeamId)) {
      return actionError(
        "You do not have permission to transfer credits to this team.",
      );
    }

    // Check the source team has enough credits
    const fromTeam = await prisma.team.findUnique({
      where: { id: fromTeamId },
      select: { id: true, name: true, credits: true },
    });

    if (!fromTeam) {
      return actionError("Source team not found.");
    }

    if ((fromTeam.credits ?? 0) < credits) {
      return actionError(
        `Insufficient credits. The source team only has ${fromTeam.credits ?? 0} credits.`,
      );
    }

    // Perform the transfer in a transaction
    await prisma.$transaction(async (tx) => {
      // Decrement source team
      await tx.team.update({
        where: { id: fromTeamId },
        data: { credits: { decrement: credits } },
      });

      // Increment destination team
      await tx.team.update({
        where: { id: toTeamId },
        data: { credits: { increment: credits } },
      });

      // Create ledger entry for source (negative)
      await tx.creditLedger.create({
        data: {
          teamId: fromTeamId,
          byUserId: userId,
          delta: -credits,
          reason: `transfer_to_team_${toTeamId}`,
        },
      });

      // Create ledger entry for destination (positive)
      await tx.creditLedger.create({
        data: {
          teamId: toTeamId,
          byUserId: userId,
          delta: credits,
          reason: `transfer_from_team_${fromTeamId}`,
        },
      });
    });

    logger.info("Credits transferred between teams", {
      userId,
      fromTeamId,
      toTeamId,
      credits,
    });

    revalidatePath("/credits");

    return actionSuccess();
  } catch (error) {
    logger.error("Error transferring credits", { error, params });
    return actionError(
      error instanceof Error
        ? error.message
        : "An error occurred while transferring credits.",
    );
  }
}

// ============================================================================
// Auto-Refill Actions
// ============================================================================

interface AutoRefillSettings {
  autoRefillEnabled: boolean;
  autoRefillThreshold: number | null;
  autoRefillAmount: number | null;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
}

type AutoRefillSettingsData = AutoRefillSettings & {
  id: string;
  name: string;
  credits: number;
};

/**
 * Get auto-refill settings for a team
 */
export async function getAutoRefillSettings(
  teamId: string,
): Promise<ActionResult<AutoRefillSettingsData>> {
  if (!teamId) {
    return actionError("Team ID is required");
  }

  try {
    const user = await requireAuth();
    const hasAccess = await verifyTeamAdminAccess(user.id, teamId);
    if (!hasAccess) {
      return actionError(
        "You do not have permission to view this team's settings.",
      );
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/auto-refill?teamId=${teamId}&userId=${user.id}`,
    );

    if (!res.ok) {
      return actionError("Failed to fetch settings");
    }

    const { data } = await res.json();
    return actionSuccess(data);
  } catch (error) {
    logger.error("Error fetching auto-refill settings", { error, teamId });
    return actionError(
      error instanceof Error ? error.message : "Failed to fetch settings",
    );
  }
}

interface UpdateAutoRefillParams {
  teamId: string;
  autoRefillEnabled: boolean;
  autoRefillThreshold?: number | null;
  autoRefillAmount?: number | null;
}

/**
 * Update auto-refill settings for a team
 */
export async function updateAutoRefillSettings(
  params: UpdateAutoRefillParams,
): Promise<ActionResult> {
  const { teamId, autoRefillEnabled, autoRefillThreshold, autoRefillAmount } =
    params;

  if (!teamId) {
    return actionError("Team ID is required");
  }

  try {
    const user = await requireAuth();
    const hasAccess = await verifyTeamAdminAccess(user.id, teamId);
    if (!hasAccess) {
      return actionError(
        "You do not have permission to modify this team's settings.",
      );
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/auto-refill`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          userId: user.id,
          autoRefillEnabled,
          autoRefillThreshold: autoRefillThreshold ?? null,
          autoRefillAmount: autoRefillAmount ?? null,
        }),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return actionError(data.message || "Failed to update settings");
    }

    logger.info("Auto-refill settings updated", {
      userId: user.id,
      teamId,
      autoRefillEnabled,
    });

    revalidatePath("/credits");
    return actionSuccess();
  } catch (error) {
    logger.error("Error updating auto-refill settings", { error, params });
    return actionError(
      error instanceof Error ? error.message : "Failed to update settings",
    );
  }
}

interface CheckoutUrlData {
  checkoutUrl: string;
}

/**
 * Create a Stripe Checkout Session for saving a payment method (setup mode)
 */
export async function createCheckoutSessionForPaymentSetup(
  teamId: string,
): Promise<ActionResult<CheckoutUrlData>> {
  if (!stripeApiKey) {
    logger.error("Stripe secret key is not configured");
    return actionError("Payments are temporarily unavailable.");
  }

  if (!teamId) {
    return actionError("Team ID is required");
  }

  try {
    const user = await requireAuth();
    if (!user.email) {
      return actionError("Email is required for payment setup.");
    }

    const hasAccess = await verifyTeamAdminAccess(user.id, teamId);
    if (!hasAccess) {
      return actionError(
        "You do not have permission to manage this team's payment settings.",
      );
    }

    // Get or create Stripe customer for the team
    let stripeCustomerId = await getTeamStripeCustomerId(teamId, user.id);

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      stripeCustomerId = await createStripeCustomer(teamId, user.email);

      // Save the customer ID to the team
      await saveTeamStripeCustomerId(teamId, user.id, stripeCustomerId);
    }

    // Create a Checkout Session in setup mode
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const body = new URLSearchParams({
      mode: "setup",
      customer: stripeCustomerId,
      "payment_method_types[]": "card",
      success_url: `${baseUrl}/credits?setup_success=true&team=${teamId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/credits?setup_cancelled=true&team=${teamId}`,
      "metadata[teamId]": teamId,
      "metadata[userId]": user.id,
    });

    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeApiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error("Failed to create Checkout session", { error, teamId });
      return actionError("Failed to initialize payment setup.");
    }

    const checkoutSession = await response.json();

    return actionSuccess({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    logger.error("Error creating checkout session for payment setup", {
      error,
      teamId,
    });
    return actionError("Failed to initialize payment setup.");
  }
}

interface PaymentMethodData {
  last4: string;
  brand: string;
}

/**
 * Process the return from a successful Stripe Checkout session
 * Retrieves the payment method and saves it to the team
 */
export async function processCheckoutSuccess(
  sessionId: string,
  teamId: string,
): Promise<ActionResult<PaymentMethodData>> {
  if (!stripeApiKey) {
    return actionError("Payments are temporarily unavailable.");
  }

  if (!sessionId || !teamId) {
    return actionError("Session ID and Team ID are required.");
  }

  try {
    const user = await requireAuth();
    const hasAccess = await verifyTeamAdminAccess(user.id, teamId);
    if (!hasAccess) {
      return actionError(
        "You do not have permission to manage this team's payment settings.",
      );
    }

    // Retrieve the Checkout Session from Stripe
    const checkoutResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=setup_intent`,
      {
        headers: {
          Authorization: `Bearer ${stripeApiKey}`,
        },
      },
    );

    if (!checkoutResponse.ok) {
      return actionError("Failed to retrieve checkout session.");
    }

    const checkoutSession = await checkoutResponse.json();

    // Verify the session is for the correct team
    if (checkoutSession.metadata?.teamId !== teamId) {
      return actionError("Session does not match team.");
    }

    // Get the payment method from the SetupIntent
    const setupIntent = checkoutSession.setup_intent;
    if (!setupIntent?.payment_method) {
      return actionError("No payment method found in session.");
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

    // Retrieve the payment method details
    const paymentMethod = await getStripePaymentMethod(paymentMethodId);

    if (!paymentMethod || paymentMethod.type !== "card") {
      return actionError("Invalid payment method.");
    }

    // Get the team's Stripe customer ID
    const stripeCustomerId = await getTeamStripeCustomerId(teamId, user.id);
    if (!stripeCustomerId) {
      return actionError("Team customer not found.");
    }

    // Set as default payment method for the customer
    await setDefaultPaymentMethod(stripeCustomerId, paymentMethodId);

    // Save to database
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/payment-method`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          userId: user.id,
          stripePaymentMethodId: paymentMethodId,
          paymentMethodLast4: paymentMethod.card?.last4 || "",
          paymentMethodBrand: paymentMethod.card?.brand || "",
        }),
      },
    );

    if (!res.ok) {
      throw new Error("Failed to save payment method to team");
    }

    logger.info("Payment method saved via Checkout", {
      teamId,
      userId: user.id,
      last4: paymentMethod.card?.last4,
    });

    revalidatePath("/credits");

    return actionSuccess({
      last4: paymentMethod.card?.last4 || "",
      brand: paymentMethod.card?.brand || "",
    });
  } catch (error) {
    logger.error("Error processing checkout success", {
      error,
      sessionId,
      teamId,
    });
    return actionError("Failed to save payment method.");
  }
}

/**
 * Remove a payment method from a team (also disables auto-refill)
 */
export async function removePaymentMethod(
  teamId: string,
): Promise<ActionResult> {
  if (!teamId) {
    return actionError("Team ID is required.");
  }

  try {
    const user = await requireAuth();
    const hasAccess = await verifyTeamAdminAccess(user.id, teamId);
    if (!hasAccess) {
      return actionError(
        "You do not have permission to manage this team's payment settings.",
      );
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/payment-method`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, userId: user.id }),
      },
    );

    if (!res.ok) {
      throw new Error("Failed to remove payment method");
    }

    logger.info("Payment method removed", { teamId, userId: user.id });

    revalidatePath("/credits");
    return actionSuccess();
  } catch (error) {
    logger.error("Error removing payment method", { error, teamId });
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to remove payment method.",
    );
  }
}

// Rate limiting for auto-refill triggers
const recentRefillAttempts = new Map<string, number>();
const REFILL_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between auto-refills

interface AutoRefillData {
  triggered: boolean;
  credits?: number;
}

/**
 * Trigger an auto-refill for a team if conditions are met
 */
export async function triggerAutoRefill(
  teamId: string,
): Promise<ActionResult<AutoRefillData>> {
  if (!stripeApiKey) {
    logger.error("Stripe secret key is not configured for auto-refill");
    return actionError("Auto-refill is not available.");
  }

  if (!teamId) {
    return actionError("Team ID is required.");
  }

  try {
    // Check if team needs auto-refill
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/auto-refill/status?teamId=${teamId}`,
    );

    if (!res.ok) {
      return actionSuccess({ triggered: false });
    }

    const { data } = await res.json();

    if (!data?.needsRefill || !data?.team) {
      return actionSuccess({ triggered: false });
    }

    const team = data.team;

    // Check rate limiting
    const lastAttempt = recentRefillAttempts.get(teamId);
    if (lastAttempt && Date.now() - lastAttempt < REFILL_COOLDOWN_MS) {
      logger.warn("Auto-refill rate limited", { teamId });
      return actionSuccess({ triggered: false });
    }

    recentRefillAttempts.set(teamId, Date.now());

    // Determine credit price
    const pricePerCredit = team.companyId
      ? COMPANY_CREDIT_PRICE
      : PERSONAL_CREDIT_PRICE;

    // Charge the saved payment method
    const chargeResult = await chargePaymentMethod({
      customerId: team.stripeCustomerId,
      paymentMethodId: team.stripePaymentMethodId,
      amount: team.autoRefillAmount * pricePerCredit,
      credits: team.autoRefillAmount,
      teamId,
      teamName: team.name,
    });

    if (!chargeResult.success) {
      logger.error("Auto-refill charge failed", {
        teamId,
        error: chargeResult.error,
      });
      return actionError(chargeResult.error || "Payment failed");
    }

    // Add credits to the team
    await addTeamCredits({
      teamId,
      credits: team.autoRefillAmount,
      byUserId: team.autoRefillUpdatedById || "system",
      reason: `auto_refill:${chargeResult.paymentIntentId}`,
    });

    logger.info("Auto-refill completed successfully", {
      teamId,
      credits: team.autoRefillAmount,
      paymentIntentId: chargeResult.paymentIntentId,
    });

    return actionSuccess({ triggered: true, credits: team.autoRefillAmount });
  } catch (error) {
    logger.error("Error processing auto-refill", { error, teamId });
    return actionError("Failed to process auto-refill.");
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function verifyTeamAdminAccess(
  userId: string,
  teamId: string,
): Promise<boolean> {
  try {
    const domainInfo = await getCompanyByMyDomain();
    const userTeams = await getUserTeams(userId);

    // Check personal team ownership
    const personalTeam = userTeams.find((t) => t.isPersonal && t.id === teamId);
    if (personalTeam) {
      return true;
    }

    if (domainInfo?.company) {
      const members = await getCompanyMembers(domainInfo.company.id);
      const me = members.find((m) => m.userId === userId);

      if (!me || me.status === "DEACTIVATED") {
        return false;
      }

      const myRole = String(me.role || "").toUpperCase();
      const isCompanyAdmin = myRole === "ADMIN" || myRole === "OWNER";

      if (isCompanyAdmin) {
        const companyTeams = await getCompanyTeams(domainInfo.company.id);
        return companyTeams.some((t: any) => t.id === teamId);
      }

      const companyTeams = await getCompanyTeams(domainInfo.company.id);
      const team = companyTeams.find((t: any) => t.id === teamId);
      if (team) {
        const membership = team.members?.find((m: any) => m.userId === userId);
        const role = String(membership?.role || "").toUpperCase();
        return role === "ADMIN" || role === "OWNER";
      }
    } else {
      const team = userTeams.find((t) => t.id === teamId);
      if (team) {
        const role = String(team.role || "").toUpperCase();
        return role === "ADMIN" || role === "OWNER";
      }
    }

    return false;
  } catch (error) {
    logger.error("Error verifying team admin access", {
      error,
      userId,
      teamId,
    });
    return false;
  }
}

async function getTeamStripeCustomerId(
  teamId: string,
  userId: string,
): Promise<string | null> {
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/team/auto-refill?teamId=${teamId}&userId=${userId}`,
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data?.stripeCustomerId || null;
}

async function saveTeamStripeCustomerId(
  teamId: string,
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/team/stripe-customer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, userId, stripeCustomerId }),
    },
  );
  if (!res.ok) {
    throw new Error("Failed to save Stripe customer ID");
  }
}

async function createStripeCustomer(
  teamId: string,
  userEmail: string,
): Promise<string> {
  const body = new URLSearchParams({
    email: userEmail,
    "metadata[teamId]": teamId,
    description: `Team ${teamId} - Auto-refill customer`,
  });

  const response = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeApiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("Failed to create Stripe customer", { error });
    throw new Error("Failed to create Stripe customer");
  }

  const customer = await response.json();
  return customer.id;
}

async function getStripePaymentMethod(paymentMethodId: string) {
  const response = await fetch(
    `https://api.stripe.com/v1/payment_methods/${paymentMethodId}`,
    {
      headers: {
        Authorization: `Bearer ${stripeApiKey}`,
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string,
) {
  const response = await fetch(
    `https://api.stripe.com/v1/customers/${customerId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeApiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "invoice_settings[default_payment_method]": paymentMethodId,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error("Failed to set default payment method", { error });
    throw new Error("Failed to set default payment method");
  }
}

async function chargePaymentMethod(params: {
  customerId: string;
  paymentMethodId: string;
  amount: number;
  credits: number;
  teamId: string;
  teamName: string;
}): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
  const { customerId, paymentMethodId, amount, credits, teamId, teamName } =
    params;

  const body = new URLSearchParams({
    amount: Math.round(amount * 100).toString(),
    currency: "usd",
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: "true",
    confirm: "true",
    description: `Auto-refill: ${credits} credits for ${teamName}`,
    "metadata[teamId]": teamId,
    "metadata[credits]": credits.toString(),
    "metadata[type]": "auto_refill",
  });

  try {
    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeApiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      return {
        success: false,
        error: result.error?.message || "Payment failed",
      };
    }

    if (result.status !== "succeeded") {
      return {
        success: false,
        error: `Payment status: ${result.status}`,
      };
    }

    return {
      success: true,
      paymentIntentId: result.id,
    };
  } catch (error) {
    logger.error("Error creating payment intent", { error });
    return {
      success: false,
      error: "Failed to process payment",
    };
  }
}
