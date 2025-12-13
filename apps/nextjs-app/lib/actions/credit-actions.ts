"use server";

import { auth } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";
import { revalidatePath } from "next/cache";
import prisma from "@/apps/nextjs-app/lib/db";
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

interface TransferCreditsResult {
  success: boolean;
  error?: string;
}

const MAX_CREDITS_PER_TRANSFER = 10000;

export async function transferCredits(
  params: TransferCreditsParams,
): Promise<TransferCreditsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const { fromTeamId, toTeamId, credits } = params;

  // Validate inputs
  if (!fromTeamId || !toTeamId) {
    return { success: false, error: "Please select both teams." };
  }

  if (fromTeamId === toTeamId) {
    return {
      success: false,
      error: "Cannot transfer credits to the same team.",
    };
  }

  if (!Number.isFinite(credits) || credits < 1) {
    return { success: false, error: "Enter at least 1 credit to transfer." };
  }

  if (credits > MAX_CREDITS_PER_TRANSFER) {
    return {
      success: false,
      error: `Cannot transfer more than ${MAX_CREDITS_PER_TRANSFER} credits at once.`,
    };
  }

  try {
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
        return { success: false, error: "Access denied." };
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
      return {
        success: false,
        error: "Credit transfers are only available for company members.",
      };
    }

    // Verify both teams are in the allowed set
    if (!allowedTeamIds.has(fromTeamId)) {
      return {
        success: false,
        error: "You do not have permission to transfer credits from this team.",
      };
    }

    if (!allowedTeamIds.has(toTeamId)) {
      return {
        success: false,
        error: "You do not have permission to transfer credits to this team.",
      };
    }

    // Check the source team has enough credits
    const fromTeam = await prisma.team.findUnique({
      where: { id: fromTeamId },
      select: { id: true, name: true, credits: true },
    });

    if (!fromTeam) {
      return { success: false, error: "Source team not found." };
    }

    if ((fromTeam.credits ?? 0) < credits) {
      return {
        success: false,
        error: `Insufficient credits. The source team only has ${fromTeam.credits ?? 0} credits.`,
      };
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

    return { success: true };
  } catch (error) {
    logger.error("Error transferring credits", {
      error,
      userId,
      params,
    });
    return {
      success: false,
      error: "An error occurred while transferring credits.",
    };
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

interface AutoRefillSettingsResult {
  success: boolean;
  data?: AutoRefillSettings & { id: string; name: string; credits: number };
  error?: string;
}

/**
 * Get auto-refill settings for a team
 */
export async function getAutoRefillSettings(
  teamId: string,
): Promise<AutoRefillSettingsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (!teamId) {
    return { success: false, error: "Team ID is required" };
  }

  try {
    const hasAccess = await verifyTeamAdminAccess(session.user.id, teamId);
    if (!hasAccess) {
      return {
        success: false,
        error: "You do not have permission to view this team's settings.",
      };
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/auto-refill?teamId=${teamId}&userId=${session.user.id}`,
    );

    if (!res.ok) {
      return { success: false, error: "Failed to fetch settings" };
    }

    const { data } = await res.json();
    return { success: true, data };
  } catch (error) {
    logger.error("Error fetching auto-refill settings", { error, teamId });
    return { success: false, error: "Failed to fetch settings" };
  }
}

interface UpdateAutoRefillParams {
  teamId: string;
  autoRefillEnabled: boolean;
  autoRefillThreshold?: number | null;
  autoRefillAmount?: number | null;
}

interface UpdateAutoRefillResult {
  success: boolean;
  error?: string;
}

/**
 * Update auto-refill settings for a team
 */
export async function updateAutoRefillSettings(
  params: UpdateAutoRefillParams,
): Promise<UpdateAutoRefillResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const { teamId, autoRefillEnabled, autoRefillThreshold, autoRefillAmount } =
    params;

  if (!teamId) {
    return { success: false, error: "Team ID is required" };
  }

  try {
    const hasAccess = await verifyTeamAdminAccess(session.user.id, teamId);
    if (!hasAccess) {
      return {
        success: false,
        error: "You do not have permission to modify this team's settings.",
      };
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/auto-refill`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          userId: session.user.id,
          autoRefillEnabled,
          autoRefillThreshold: autoRefillThreshold ?? null,
          autoRefillAmount: autoRefillAmount ?? null,
        }),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error: data.message || "Failed to update settings",
      };
    }

    logger.info("Auto-refill settings updated", {
      userId: session.user.id,
      teamId,
      autoRefillEnabled,
    });

    revalidatePath("/credits");
    return { success: true };
  } catch (error) {
    logger.error("Error updating auto-refill settings", { error, params });
    return { success: false, error: "Failed to update settings" };
  }
}

interface SetupPaymentResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

/**
 * Create a Stripe Checkout Session for saving a payment method (setup mode)
 */
export async function createCheckoutSessionForPaymentSetup(
  teamId: string,
): Promise<SetupPaymentResult> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return { success: false, error: "Unauthorized" };
  }

  if (!stripeApiKey) {
    logger.error("Stripe secret key is not configured");
    return { success: false, error: "Payments are temporarily unavailable." };
  }

  if (!teamId) {
    return { success: false, error: "Team ID is required" };
  }

  try {
    const hasAccess = await verifyTeamAdminAccess(session.user.id, teamId);
    if (!hasAccess) {
      return {
        success: false,
        error:
          "You do not have permission to manage this team's payment settings.",
      };
    }

    // Get or create Stripe customer for the team
    let stripeCustomerId = await getTeamStripeCustomerId(
      teamId,
      session.user.id,
    );

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      stripeCustomerId = await createStripeCustomer(teamId, session.user.email);

      // Save the customer ID to the team
      await saveTeamStripeCustomerId(teamId, session.user.id, stripeCustomerId);
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
      "metadata[userId]": session.user.id,
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
      return { success: false, error: "Failed to initialize payment setup." };
    }

    const checkoutSession = await response.json();

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
    };
  } catch (error) {
    logger.error("Error creating checkout session for payment setup", {
      error,
      teamId,
    });
    return { success: false, error: "Failed to initialize payment setup." };
  }
}

interface ProcessCheckoutSuccessResult {
  success: boolean;
  paymentMethod?: {
    last4: string;
    brand: string;
  };
  error?: string;
}

/**
 * Process the return from a successful Stripe Checkout session
 * Retrieves the payment method and saves it to the team
 */
export async function processCheckoutSuccess(
  sessionId: string,
  teamId: string,
): Promise<ProcessCheckoutSuccessResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (!stripeApiKey) {
    return { success: false, error: "Payments are temporarily unavailable." };
  }

  if (!sessionId || !teamId) {
    return { success: false, error: "Session ID and Team ID are required." };
  }

  try {
    const hasAccess = await verifyTeamAdminAccess(session.user.id, teamId);
    if (!hasAccess) {
      return {
        success: false,
        error:
          "You do not have permission to manage this team's payment settings.",
      };
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
      return { success: false, error: "Failed to retrieve checkout session." };
    }

    const checkoutSession = await checkoutResponse.json();

    // Verify the session is for the correct team
    if (checkoutSession.metadata?.teamId !== teamId) {
      return { success: false, error: "Session does not match team." };
    }

    // Get the payment method from the SetupIntent
    const setupIntent = checkoutSession.setup_intent;
    if (!setupIntent?.payment_method) {
      return { success: false, error: "No payment method found in session." };
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

    // Retrieve the payment method details
    const paymentMethod = await getStripePaymentMethod(paymentMethodId);

    if (!paymentMethod || paymentMethod.type !== "card") {
      return { success: false, error: "Invalid payment method." };
    }

    // Get the team's Stripe customer ID
    const stripeCustomerId = await getTeamStripeCustomerId(
      teamId,
      session.user.id,
    );
    if (!stripeCustomerId) {
      return { success: false, error: "Team customer not found." };
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
          userId: session.user.id,
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
      userId: session.user.id,
      last4: paymentMethod.card?.last4,
    });

    revalidatePath("/credits");

    return {
      success: true,
      paymentMethod: {
        last4: paymentMethod.card?.last4 || "",
        brand: paymentMethod.card?.brand || "",
      },
    };
  } catch (error) {
    logger.error("Error processing checkout success", {
      error,
      sessionId,
      teamId,
    });
    return { success: false, error: "Failed to save payment method." };
  }
}

interface RemovePaymentMethodResult {
  success: boolean;
  error?: string;
}

/**
 * Remove a payment method from a team (also disables auto-refill)
 */
export async function removePaymentMethod(
  teamId: string,
): Promise<RemovePaymentMethodResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (!teamId) {
    return { success: false, error: "Team ID is required." };
  }

  try {
    const hasAccess = await verifyTeamAdminAccess(session.user.id, teamId);
    if (!hasAccess) {
      return {
        success: false,
        error:
          "You do not have permission to manage this team's payment settings.",
      };
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/payment-method`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, userId: session.user.id }),
      },
    );

    if (!res.ok) {
      throw new Error("Failed to remove payment method");
    }

    logger.info("Payment method removed", { teamId, userId: session.user.id });

    revalidatePath("/credits");
    return { success: true };
  } catch (error) {
    logger.error("Error removing payment method", { error, teamId });
    return { success: false, error: "Failed to remove payment method." };
  }
}

// Rate limiting for auto-refill triggers
const recentRefillAttempts = new Map<string, number>();
const REFILL_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between auto-refills

interface TriggerAutoRefillResult {
  success: boolean;
  triggered: boolean;
  credits?: number;
  error?: string;
}

/**
 * Trigger an auto-refill for a team if conditions are met
 */
export async function triggerAutoRefill(
  teamId: string,
): Promise<TriggerAutoRefillResult> {
  if (!stripeApiKey) {
    logger.error("Stripe secret key is not configured for auto-refill");
    return {
      success: false,
      triggered: false,
      error: "Auto-refill is not available.",
    };
  }

  if (!teamId) {
    return { success: false, triggered: false, error: "Team ID is required." };
  }

  try {
    // Check if team needs auto-refill
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/auto-refill/status?teamId=${teamId}`,
    );

    if (!res.ok) {
      return { success: true, triggered: false };
    }

    const { data } = await res.json();

    if (!data?.needsRefill || !data?.team) {
      return { success: true, triggered: false };
    }

    const team = data.team;

    // Check rate limiting
    const lastAttempt = recentRefillAttempts.get(teamId);
    if (lastAttempt && Date.now() - lastAttempt < REFILL_COOLDOWN_MS) {
      logger.warn("Auto-refill rate limited", { teamId });
      return { success: true, triggered: false, error: "Rate limited" };
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
      return { success: false, triggered: true, error: chargeResult.error };
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

    return {
      success: true,
      triggered: true,
      credits: team.autoRefillAmount,
    };
  } catch (error) {
    logger.error("Error processing auto-refill", { error, teamId });
    return {
      success: false,
      triggered: false,
      error: "Failed to process auto-refill.",
    };
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
