import { NextResponse } from "next/server";

import {
  APP_BASE_URL,
  PERSONAL_MIN_STUDY_COST_CENTS,
  COMPANY_MIN_STUDY_COST_CENTS,
  MAX_FUND_AMOUNT_CENTS,
} from "@/apps/shared/constants";
import { logger } from "@/apps/shared/logger";
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getUserTeams,
} from "@/apps/nextjs-app/lib/db/data";

type AllowedTeam = {
  id: string;
  name: string;
  isPersonal: boolean;
  companyId?: string | null;
};

const stripeApiKey = process.env.STRIPE_SECRET_KEY;

async function createStripeCheckoutSession({
  teamId,
  teamName,
  amountCents,
  userId,
  userEmail,
}: {
  teamId: string;
  teamName: string;
  amountCents: number;
  userId: string;
  userEmail: string;
}) {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Invalid funding amount.");
  }

  const body = new URLSearchParams({
    mode: "payment",
    // Pre-fill the customer's email for Stripe Checkout
    customer_email: userEmail,
    // Enable Stripe to send a receipt after successful payment
    "payment_intent_data[receipt_email]": userEmail,
    success_url: `${APP_BASE_URL}/funds?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_BASE_URL}/funds?status=cancelled`,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Add funds for ${teamName}`,
    "line_items[0][price_data][product_data][metadata][teamId]": teamId,
    "line_items[0][price_data][product_data][metadata][purchasedByUserId]":
      userId,
    "line_items[0][price_data][unit_amount]": `${amountCents}`,
    "line_items[0][quantity]": "1",
    "metadata[teamId]": teamId,
    "metadata[purchasedByUserId]": userId,
    "metadata[amountCents]": `${amountCents}`,
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeApiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    logger.error("Failed to create Stripe checkout session", {
      status: response.status,
      error: errorBody?.slice(0, 300),
    });
    throw new Error("Unable to start checkout at this time.");
  }

  const result = (await response.json().catch(() => ({}))) as { url?: string };
  return result?.url;
}

export async function POST(request: Request) {
  if (!stripeApiKey) {
    logger.error("Stripe secret key is not configured");
    return NextResponse.json(
      {
        error: "Payments are temporarily unavailable. Please try again later.",
      },
      { status: 500 },
    );
  }

  const { user } = await getCurrentUser();
  let payload: { teamId?: string; amountCents?: number } = {};

  try {
    payload = (await request.json()) as {
      teamId?: string;
      amountCents?: number;
    };
  } catch (error) {
    logger.warn("Invalid JSON payload for funding checkout", { error });
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }

  const amountCents = Number(payload.amountCents ?? 0);
  const teamId = String(payload.teamId || "");

  if (!teamId || Number.isNaN(amountCents) || amountCents <= 0) {
    return NextResponse.json(
      {
        error: "Select a team and enter a valid amount to add.",
      },
      { status: 400 },
    );
  }

  if (amountCents > MAX_FUND_AMOUNT_CENTS) {
    return NextResponse.json(
      {
        error: `To add more than $${(MAX_FUND_AMOUNT_CENTS / 100).toFixed(2)} at once, please contact payments@askseer.ai.`,
      },
      { status: 400 },
    );
  }

  let domainInfo: any = null;
  try {
    domainInfo = await getCompanyByMyDomain();
  } catch (error) {
    logger.error("Failed to fetch domain info for checkout", { error });
  }

  let userTeams: any[] = [];
  try {
    userTeams = await getUserTeams(user.id);
  } catch (error) {
    logger.error("Failed to fetch user teams for checkout", { error });
  }

  const allowedTeams = new Map<string, AllowedTeam>();
  let isCompanyMember = false;

  const personalTeam = userTeams.find((team) => team.isPersonal);
  if (personalTeam) {
    allowedTeams.set(personalTeam.id, {
      id: personalTeam.id,
      name: `${personalTeam.name} (Personal)`,
      isPersonal: true,
      companyId: personalTeam.companyId ?? null,
    });
  }

  if (domainInfo?.company) {
    isCompanyMember = true;
    let members: any[] = [];
    try {
      members = await getCompanyMembers(domainInfo.company.id);
    } catch (error) {
      logger.error("Failed to fetch company members for checkout", { error });
    }

    const me = members.find((member) => member.userId === user.id);
    if (!me || me.status === "DEACTIVATED") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const myRole = String(me.role || "").toUpperCase();
    const isCompanyAdmin = myRole === "ADMIN" || myRole === "OWNER";

    let companyTeams: any[] = [];
    try {
      companyTeams = await getCompanyTeams(domainInfo.company.id);
    } catch (error) {
      logger.error("Failed to fetch company teams for checkout", { error });
    }

    companyTeams.forEach((team) => {
      const membershipRole = String(
        team?.members?.find((m: any) => m.userId === user.id)?.role || "",
      ).toUpperCase();
      if (
        isCompanyAdmin ||
        membershipRole === "ADMIN" ||
        membershipRole === "OWNER"
      ) {
        allowedTeams.set(team.id, {
          id: team.id,
          name: team.isPersonal ? `${team.name} (Personal)` : team.name,
          isPersonal: Boolean(team.isPersonal),
          companyId: domainInfo.company.id,
        });
      }
    });
  } else {
    userTeams
      .filter((team) => {
        const role = String(team.role || "").toUpperCase();
        return !team.isPersonal && (role === "ADMIN" || role === "OWNER");
      })
      .forEach((team) => {
        allowedTeams.set(team.id, {
          id: team.id,
          name: team.name,
          isPersonal: Boolean(team.isPersonal),
          companyId: team.companyId ?? null,
        });
      });
  }

  if (!allowedTeams.has(teamId)) {
    return NextResponse.json(
      {
        error: "You do not have permission to add funds for the selected team.",
      },
      { status: 403 },
    );
  }

  // Validate minimum amount based on team type
  const selectedTeam = allowedTeams.get(teamId)!;
  const minFundAmountCents = selectedTeam.companyId
    ? COMPANY_MIN_STUDY_COST_CENTS
    : PERSONAL_MIN_STUDY_COST_CENTS;

  if (amountCents < minFundAmountCents) {
    return NextResponse.json(
      {
        error: `Minimum amount is $${(minFundAmountCents / 100).toFixed(2)}.`,
      },
      { status: 400 },
    );
  }

  try {
    const checkoutUrl = await createStripeCheckoutSession({
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      amountCents,
      userId: user.id,
      userEmail: user.email,
    });

    if (!checkoutUrl) {
      throw new Error("No checkout URL returned from Stripe.");
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    logger.error("Error creating checkout session", { error });
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 },
    );
  }
}
