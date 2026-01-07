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
import { getStripeClient } from "@/apps/nextjs-app/lib/stripe";

// Team member structure from company teams API
interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastAccessedAt?: string | null;
  };
}

// Company team structure from API
interface CompanyTeam {
  id: string;
  name: string;
  isPersonal: boolean;
  isDefaultForCompany: boolean;
  credits: number;
  createdAt: string;
  memberCount: number;
  members: TeamMember[];
}

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

    // Verify user is part of a company (required for transfers)
    const domainInfo = await getCompanyByMyDomain();
    if (!domainInfo?.company) {
      return actionError(
        "Credit transfers are only available for company members.",
      );
    }

    // Verify admin access to both teams
    const [hasFromAccess, hasToAccess] = await Promise.all([
      verifyTeamAdminAccess(userId, fromTeamId),
      verifyTeamAdminAccess(userId, toTeamId),
    ]);

    if (!hasFromAccess) {
      return actionError(
        "You do not have permission to transfer credits from this team.",
      );
    }

    if (!hasToAccess) {
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
  const stripe = getStripeClient();
  if (!stripe) {
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

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      success_url: `${baseUrl}/credits?setup_success=true&team=${teamId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/credits?setup_cancelled=true&team=${teamId}`,
      metadata: {
        teamId,
        userId: user.id,
      },
    });

    if (!checkoutSession.url) {
      logger.error("Checkout session created but no URL returned", { teamId });
      return actionError("Failed to initialize payment setup.");
    }

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
  const stripe = getStripeClient();
  if (!stripe) {
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

    // Retrieve the Checkout Session from Stripe with expanded setup_intent
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });

    // Verify the session is for the correct team
    if (checkoutSession.metadata?.teamId !== teamId) {
      return actionError("Session does not match team.");
    }

    // Get the payment method from the SetupIntent
    const setupIntent = checkoutSession.setup_intent;
    if (!setupIntent || typeof setupIntent === "string") {
      return actionError("No payment method found in session.");
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    if (!paymentMethodId) {
      return actionError("No payment method found in session.");
    }

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
const REFILL_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between auto-refills
const MAX_RATE_LIMIT_ENTRIES = 1000; // Prevent unbounded growth

/**
 * Rate limiter with automatic cleanup to prevent memory leaks.
 * Stores timestamps of recent refill attempts per team.
 */
class RefillRateLimiter {
  private attempts = new Map<string, number>();
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 5 * 60 * 1000; // Cleanup every 5 minutes

  isRateLimited(teamId: string): boolean {
    this.cleanupIfNeeded();

    const lastAttempt = this.attempts.get(teamId);
    if (lastAttempt && Date.now() - lastAttempt < REFILL_COOLDOWN_MS) {
      return true;
    }
    return false;
  }

  recordAttempt(teamId: string): void {
    this.attempts.set(teamId, Date.now());
  }

  private cleanupIfNeeded(): void {
    const now = Date.now();

    // Only cleanup periodically or if we've exceeded max entries
    if (
      now - this.lastCleanup < this.cleanupInterval &&
      this.attempts.size < MAX_RATE_LIMIT_ENTRIES
    ) {
      return;
    }

    this.lastCleanup = now;

    // Remove expired entries
    for (const [teamId, timestamp] of this.attempts) {
      if (now - timestamp >= REFILL_COOLDOWN_MS) {
        this.attempts.delete(teamId);
      }
    }
  }
}

const refillRateLimiter = new RefillRateLimiter();

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
  const stripe = getStripeClient();
  if (!stripe) {
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
    if (refillRateLimiter.isRateLimited(teamId)) {
      logger.warn("Auto-refill rate limited", { teamId });
      return actionSuccess({ triggered: false });
    }

    refillRateLimiter.recordAttempt(teamId);

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
        return companyTeams.some((t: CompanyTeam) => t.id === teamId);
      }

      const companyTeams = await getCompanyTeams(domainInfo.company.id);
      const team = companyTeams.find((t: CompanyTeam) => t.id === teamId);
      if (team) {
        const membership = team.members?.find((m: TeamMember) => m.userId === userId);
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
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const customer = await stripe.customers.create({
    email: userEmail,
    metadata: { teamId },
    description: `Team ${teamId} - Auto-refill customer`,
  });

  return customer.id;
}

async function getStripePaymentMethod(paymentMethodId: string) {
  const stripe = getStripeClient();
  if (!stripe) {
    return null;
  }

  try {
    return await stripe.paymentMethods.retrieve(paymentMethodId);
  } catch {
    return null;
  }
}

async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string,
) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

async function chargePaymentMethod(params: {
  customerId: string;
  paymentMethodId: string;
  amount: number;
  credits: number;
  teamId: string;
  teamName: string;
}): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { success: false, error: "Stripe is not configured" };
  }

  const { customerId, paymentMethodId, amount, credits, teamId, teamName } =
    params;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: `Auto-refill: ${credits} credits for ${teamName}`,
      metadata: {
        teamId,
        credits: credits.toString(),
        type: "auto_refill",
      },
    });

    if (paymentIntent.status !== "succeeded") {
      return {
        success: false,
        error: `Payment status: ${paymentIntent.status}`,
      };
    }

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    logger.error("Error creating payment intent", { error });
    const message =
      error instanceof Error ? error.message : "Failed to process payment";
    return {
      success: false,
      error: message,
    };
  }
}
