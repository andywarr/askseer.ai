"use server";

// Next imports
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Lib function imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { logger } from "@/apps/shared/logger";
import { Resend } from "resend";
import { createStyledEmailHtml } from "@/apps/nextjs-app/lib/email-templates";
import { APP_BASE_URL } from "@/apps/shared/constants";

import { StudyType } from "@prisma/client";
import { parseJobEnvelope } from "@/apps/shared/jobSchema";
import {
  getEmailDomain,
  isConsumerDomain,
} from "@/apps/nextjs-app/lib/domains";
import type { TeamJoinPolicy } from "@/apps/nextjs-app/types/types";

interface FileData {
  name: string;
  data: string;
  key?: string;
  size: number;
  type: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  type: string;
  violated: string;
  reason: string;
  recommendation: string;
}

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  severity?: number | null;
  recommendations: Array<CWRecommendationData>;
}

interface CWRecommendationData {
  recommendation: string;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

interface StudyDetails {
  name: string;
  goal: string;
  files: FileData[];
  heuristic: string;
  context: string | null;
  userId: string;
}

/**
 * Fetch helper with timeout and improved error handling
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Response object
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        logger.error("Request timeout", {
          url,
          timeout: timeoutMs,
        });
        throw new Error(
          "The request timed out. The database service may be experiencing high load. Please try again.",
        );
      }

      if (error.message.toLowerCase().includes("fetch")) {
        logger.error("Network error", {
          url,
          error: error.message,
        });
        throw new Error(
          "Unable to connect to the database service. Please check your connection and try again.",
        );
      }
    }

    // Re-throw unknown errors
    throw error;
  }
}

/**
 * Result type for dbFetch operations
 */
interface DbFetchResult<T> {
  data: T;
  ok: boolean;
  error?: string;
}

/**
 * Centralized fetch helper for DB worker API calls
 * @param path - API path (e.g., "/api/team/auto-refill")
 * @param options - Fetch options
 * @returns Object with data, ok status, and optional error message
 */
async function dbFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<DbFetchResult<T>> {
  const url = `${process.env.DB_WORKER_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      data: null as T,
      ok: false,
      error: body.message || `Request failed: ${path}`,
    };
  }

  const { data } = await res.json();
  return { data, ok: true };
}

export async function getUser(userId: string) {
  logger.debug("Getting user data", { userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's data", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/user?userId=${userId}`,
      {
        cache: "no-store", // Always fetch fresh user data
      },
    );
    const { data: user } = await response.json();

    // If a user does not exist there is a problem
    if (!user) {
      logger.error("User not found in database", { userId });
      redirect("/error");
    }

    logger.info("User data retrieved successfully", { userId });
    return user;
  } catch (error) {
    logger.error("Error fetching user data", { userId, error });
    redirect("/error");
  }
}

export async function getTeam(teamId: string) {
  const session = await isAuthenticated();
  logger.debug("Getting team data", { teamId, userId: session.userId });
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team?teamId=${teamId}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to fetch team", {
        teamId,
        userId: session.userId,
        status: res.status,
      });
      throw new Error("Failed to fetch team");
    }
    const { data } = await res.json();
    logger.info("Team data retrieved successfully", {
      teamId,
      userId: session.userId,
    });
    return data;
  } catch (error) {
    logger.error("Error fetching team data", {
      teamId,
      userId: session.userId,
      error,
    });
    throw error;
  }
}

export async function getUserTeams(userId: string) {
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("Unauthorized attempt to fetch teams for another user", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    throw new Error("Unauthorized");
  }

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/user/teams?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to fetch user teams", {
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to fetch user teams");
    }
    const { data } = await res.json();
    const teams = (
      data as Array<{
        id: string;
        name: string;
        isPersonal: boolean;
        companyId: string | null;
        companyName: string | null;
        companyPersonalTeamsDisabled?: boolean;
        credits: number;
        role: string;
        joinPolicy: TeamJoinPolicy;
        isDefaultForCompany: boolean;
      }>
    ).map((team) => ({
      ...team,
      companyPersonalTeamsDisabled: Boolean(team.companyPersonalTeamsDisabled),
    }));
    return teams.filter(
      (team) => !(team.isPersonal && team.companyPersonalTeamsDisabled),
    );
  } catch (error) {
    logger.error("Error fetching user teams", { userId, error });
    throw error;
  }
}

export async function updateUserSelectedTeam(userId: string, teamId: string) {
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("Unauthorized attempt to update selected team", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    throw new Error("Unauthorized");
  }

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/user/selected-team`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, teamId }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      let message = "Failed to update selected team";
      try {
        const parsed = JSON.parse(bodyText || "{}");
        if (parsed?.message) {
          message = parsed.message;
        }
      } catch {
        // ignore
      }
      logger.error("Failed to update user selected team", {
        userId,
        teamId,
        status: res.status,
        body: bodyText.slice(0, 200),
      });
      if (res.status === 403) {
        throw new Error(message || "You are not a member of this team");
      }
      throw new Error(message);
    }

    const { data } = await res.json();

    // Aggressively revalidate all paths to ensure fresh data
    revalidatePath("/", "layout");
    revalidatePath("/studies");
    revalidatePath("/account");
    revalidatePath("/new");
    revalidatePath("/walkthrough/new");
    revalidatePath("/evaluation/new");
    revalidatePath("/persona/new");

    logger.info("User selected team updated and paths revalidated", {
      userId,
      teamId,
    });

    return data as { id: string; selectedTeamId: string | null };
  } catch (error) {
    logger.error("Error updating user selected team", {
      userId,
      teamId,
      error,
    });
    throw error;
  }
}

// Company/domain helpers for Account page UI
export async function getCompanyByMyDomain() {
  // Returns the company (if any) associated with the current user's email domain
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  const domain = getEmailDomain(user?.email);
  if (!domain) return { domain: null, isConsumer: false, company: null };
  const isConsumer = isConsumerDomain(domain);
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/by-domain?domain=${encodeURIComponent(domain)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to fetch company by domain", {
        domain,
        userId: session.userId,
        status: res.status,
      });
      return { domain, isConsumer, company: null };
    }
    const { data } = await res.json();
    return {
      domain,
      isConsumer,
      company: data?.company || null,
      domainStatus: data?.domainStatus || null,
      requestedByUserId: data?.requestedByUserId || null,
    };
  } catch (error) {
    logger.error("Error fetching company by domain", {
      domain,
      userId: session.userId,
      error,
    });
    return { domain, isConsumer, company: null };
  }
}

export async function createCompanyForMyDomain(companyName?: string) {
  // Creates a Company and CompanyDomain for the current user's email domain if it's not a consumer domain
  // Also (best-effort) attaches the user's personal team to that company if one exists and has no companyId
  // Revalidates the account page on success
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  const domain = getEmailDomain(user?.email);
  if (!domain)
    throw new Error("Your account does not have a valid email domain.");
  if (isConsumerDomain(domain))
    throw new Error("Consumer email domains cannot create a company.");

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/create-for-domain`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          name: companyName?.trim() || null,
          userId: user.id,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to create company for domain", {
        domain,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to create company for domain");
    }
    const { data } = await res.json();
    revalidatePath("/account");

    // Notify teams about pending claim (fire-and-forget)
    try {
      const resend = new Resend(process.env.AUTH_RESEND_KEY);
      const claimTitle = companyName?.trim() || domain;
      const internalContent = `
        <div style="background:#f8fafc;padding:24px;border-radius:8px;border:1px solid #e2e8f0;">
          <h3 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#3f3f46;">Claim Details</h3>
          <table style="width:100%;border-collapse:collapse;">
            <tr style=\"border-bottom:1px solid #e2e8f0;\">
              <td style=\"padding:8px 0;font-weight:500;color:#3f3f46;width:35%;\">Company Name</td>
              <td style=\"padding:8px 0;color:#64748b;\">${claimTitle}</td>
            </tr>
            <tr style=\"border-bottom:1px solid #e2e8f0;\">
              <td style=\"padding:8px 0;font-weight:500;color:#3f3f46;\">Domain</td>
              <td style=\"padding:8px 0;color:#64748b;\">${domain}</td>
            </tr>
            <tr style=\"border-bottom:1px solid #e2e8f0;\">
              <td style=\"padding:8px 0;font-weight:500;color:#3f3f46;\">Requested By</td>
              <td style=\"padding:8px 0;color:#64748b;\">${user.name || "(no name)"} &lt;${user.email}&gt;</td>
            </tr>
            <tr>
              <td style=\"padding:8px 0;font-weight:500;color:#3f3f46;\">Status</td>
              <td style=\"padding:8px 0;color:#c2410c;font-weight:600;\">PENDING</td>
            </tr>
          </table>
        </div>
        <div style="background:#fef3c7;border:1px solid #f59e0b;padding:16px;margin-top:16px;border-radius:8px;">
          <p style="margin:0;font-size:14px;color:#92400e;font-weight:500;">Action Required: Update ApprovalStatus for Company & CompanyDomain in the database when verified.</p>
        </div>`;
      await resend.emails.send({
        from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
        to: ["teams@askseer.ai"],
        subject: `Company Claim Pending Review - ${claimTitle}`,
        html: createStyledEmailHtml({
          title: "New Company Claim",
          subtitle:
            "A user has claimed a company. Please verify domain ownership and approve or reject.",
          content: internalContent,
          showFooter: false,
          footerContact: "teams@askseer.ai",
        }),
        text: `New company claim\n\nCompany: ${claimTitle}\nDomain: ${domain}\nRequested By: ${user.name || "(no name)"} <${user.email}>\nStatus: PENDING\n\nAction: Manually review and update company and domain status in database.`,
      });
      logger.info("Company claim email sent to teams", {
        companyId: data?.companyId,
        domain,
        userId: user.id,
      });
    } catch (emailError: any) {
      logger.error("Failed to send company claim email", {
        domain,
        userId: user.id,
        error: emailError?.message,
      });
    }

    return { success: true, companyId: data?.companyId };
  } catch (error) {
    logger.error("Error creating company for domain", { domain, error });
    throw error;
  }
}

export async function getCompanyMembers(companyId: string) {
  const session = await isAuthenticated();
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/members?companyId=${encodeURIComponent(companyId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to fetch company members", {
        companyId,
        userId: session.userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to fetch company members");
    }
    const { data } = await res.json();
    return data as Array<{
      companyId: string;
      userId: string;
      role: string;
      canCreatePersonas: boolean;
      status: string;
      joinedAt: string;
      deactivatedAt: string | null;
      user: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
        lastAccessedAt?: string | null;
      };
    }>;
  } catch (error) {
    logger.error("Error fetching company members", {
      companyId,
      userId: session.userId,
      error,
    });
    throw error;
  }
}

export async function getCompanyMembership(companyId: string, userId: string) {
  const session = await isAuthenticated();
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/membership?companyId=${encodeURIComponent(companyId)}&userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to fetch company membership", {
        companyId,
        userId,
        requestingUserId: session.userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      return null;
    }
    const { data } = await res.json();
    return data as {
      id: string;
      role: string;
      status: string;
      joinedAt: string;
    } | null;
  } catch (error) {
    logger.error("Error fetching company membership", {
      companyId,
      userId,
      requestingUserId: session.userId,
      error,
    });
    return null;
  }
}

export async function getUserCompanyRole(
  userId: string,
  companyId: string,
): Promise<string | null> {
  logger.debug("Getting user company role", { userId, companyId });
  try {
    const membership = await getCompanyMembership(companyId, userId);
    // The API already filters for ACTIVE status
    return membership?.role || null;
  } catch (error) {
    logger.error("Error getting user company role", {
      userId,
      companyId,
      error,
    });
    return null;
  }
}

export async function isUserCompanyAdmin(
  userId: string,
  companyId: string,
): Promise<boolean> {
  logger.debug("Checking if user is company admin", { userId, companyId });
  const role = await getUserCompanyRole(userId, companyId);
  return role === "ADMIN" || role === "OWNER";
}

export async function getUserTeamRole(
  userId: string,
  teamId: string,
): Promise<string | null> {
  logger.debug("Getting user team role", { userId, teamId });
  try {
    const team = await getTeam(teamId);
    const member = team.memberships?.find((m: any) => m.userId === userId);
    return member?.role || null;
  } catch (error) {
    logger.error("Error getting user team role", { userId, teamId, error });
    return null;
  }
}

export async function isUserTeamAdmin(
  userId: string,
  teamId: string,
): Promise<boolean> {
  logger.debug("Checking if user is team admin", { userId, teamId });
  const role = await getUserTeamRole(userId, teamId);
  return role === "ADMIN" || role === "OWNER";
}

export async function getCompanyTeams(companyId: string) {
  const session = await isAuthenticated();
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/teams?companyId=${encodeURIComponent(companyId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to fetch company teams", {
        companyId,
        userId: session.userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to fetch company teams");
    }
    const { data } = await res.json();
    return data as Array<{
      id: string;
      name: string;
      isPersonal: boolean;
      isDefaultForCompany: boolean;
      joinPolicy: TeamJoinPolicy;
      credits: number;
      createdAt: string;
      memberCount: number;
      members: Array<{
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
      }>;
    }>;
  } catch (error) {
    logger.error("Error fetching company teams", {
      companyId,
      userId: session.userId,
      error,
    });
    throw error;
  }
}

export async function createTeam(
  companyId: string,
  userId: string,
  name: string,
  members?: Array<{ userId: string; role: string; email?: string }>,
) {
  await isAuthenticated();
  try {
    const payloadMembers = (members || []).map(({ userId, role }) => ({
      userId,
      role,
    }));
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        userId,
        name,
        members: payloadMembers,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to create team", {
        companyId,
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to create team");
    }
    const { data } = await res.json();

    // Inform new members via email (best effort)
    if (members?.length) {
      try {
        const resend = new Resend(process.env.AUTH_RESEND_KEY);
        await Promise.all(
          members
            .filter((m) => m.userId !== userId && m.email)
            .map((m) =>
              resend.emails.send({
                from: process.env.AUTH_RESEND_FROM || "support@askseer.ai",
                to: m.email!,
                subject: `You've been added to ${name} on Seer`,
                html: createStyledEmailHtml({
                  title: "Added to a team",
                  subtitle: `You were added to ${name} as ${m.role.toLowerCase()}.`,
                  content: "",
                  buttonText: "Open Seer",
                  buttonUrl: APP_BASE_URL,
                  footerContact: "support@askseer.ai",
                }),
                text: `You were added to the team ${name} on Seer as ${m.role}.`,
              }),
            ),
        );
      } catch (emailError: any) {
        logger.error("Failed to send team member email", {
          companyId,
          userId,
          teamName: name,
          error: emailError,
        });
      }
    }

    revalidatePath("/teams", "page");
    revalidatePath("/", "layout");
    return data;
  } catch (error) {
    logger.error("Error creating team", { companyId, userId, error });
    throw error;
  }
}

export async function updateTeamName(
  teamId: string,
  userId: string,
  name: string,
) {
  const session = await isAuthenticated();

  if (session.userId !== userId) {
    logger.warn("User attempted to rename a team as another user", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      teamId,
    });
    redirect("/error");
  }

  const trimmedName = name.trim();

  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/team/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, userId, name: trimmedName }),
    });

    const responseText = await res.text();
    let parsed: any = null;
    if (responseText) {
      try {
        parsed = JSON.parse(responseText);
      } catch (error) {
        parsed = null;
      }
    }

    if (!res.ok) {
      let message = "Failed to update team name";
      if (parsed?.message) {
        message = parsed.message;
      } else if (responseText) {
        message = responseText;
      }
      logger.error("Failed to update team name", {
        teamId,
        userId,
        status: res.status,
        message,
      });
      const error = new Error(message);
      (error as any).status = res.status;
      throw error;
    }

    logger.info("Team name updated", { teamId, userId });
    revalidatePath("/teams");
    return parsed?.data ?? null;
  } catch (error) {
    logger.error("Error updating team name", { teamId, userId, error });
    throw error;
  }
}

export async function updateTeamDescription(
  teamId: string,
  userId: string,
  description: string | null,
) {
  const session = await isAuthenticated();

  if (session.userId !== userId) {
    logger.warn("User attempted to update team description as another user", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      teamId,
    });
    redirect("/error");
  }

  const trimmedDescription = description?.trim() || null;

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/description`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          userId,
          description: trimmedDescription,
        }),
      },
    );

    const responseText = await res.text();
    let parsed: any = null;
    if (responseText) {
      try {
        parsed = JSON.parse(responseText);
      } catch (error) {
        parsed = null;
      }
    }

    if (!res.ok) {
      let message = "Failed to update team description";
      if (parsed?.message) {
        message = parsed.message;
      } else if (responseText) {
        message = responseText;
      }
      logger.error("Failed to update team description", {
        teamId,
        userId,
        status: res.status,
        message,
      });
      const error = new Error(message);
      (error as any).status = res.status;
      throw error;
    }

    logger.info("Team description updated", { teamId, userId });
    revalidatePath("/teams");
    return parsed?.data ?? null;
  } catch (error) {
    logger.error("Error updating team description", { teamId, userId, error });
    throw error;
  }
}

export async function updateTeamJoinPolicy(
  teamId: string,
  userId: string,
  joinPolicy: TeamJoinPolicy,
) {
  const session = await isAuthenticated();

  if (session.userId !== userId) {
    logger.warn("User attempted to update team join settings as another user", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      teamId,
    });
    redirect("/error");
  }

  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/team/join`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, userId, joinPolicy }),
    });

    const responseText = await res.text();
    let parsed: any = null;
    if (responseText) {
      try {
        parsed = JSON.parse(responseText);
      } catch (error) {
        parsed = null;
      }
    }

    if (!res.ok) {
      let message = "Failed to update team join settings";
      if (parsed?.message) {
        message = parsed.message;
      } else if (responseText) {
        message = responseText;
      }
      logger.error("Failed to update team join settings", {
        teamId,
        userId,
        status: res.status,
        message,
      });
      const error = new Error(message);
      (error as any).status = res.status;
      throw error;
    }

    logger.info("Team join settings updated", { teamId, userId, joinPolicy });
    revalidatePath("/teams");
    return parsed?.data ?? null;
  } catch (error) {
    logger.error("Error updating team join settings", {
      teamId,
      userId,
      joinPolicy,
      error,
    });
    throw error;
  }
}

export async function addMembersToTeam(
  teamId: string,
  teamName: string,
  members: Array<{ userId: string; role: string; email?: string }>,
) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    if (!members.length) {
      return { success: true };
    }

    const payloadMembers = members.map(({ userId, role }) => ({
      userId,
      role,
    }));

    const res = await fetch(`${process.env.DB_WORKER_URL}/api/team/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        members: payloadMembers,
        invitedById: user.id,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to add members to team", {
        teamId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to invite team members");
    }

    try {
      const resend = new Resend(process.env.AUTH_RESEND_KEY);
      const inviter = user.name || user.email;
      await Promise.all(
        members
          .filter((member) => member.email && member.userId !== user.id)
          .map((member) =>
            resend.emails.send({
              from: process.env.AUTH_RESEND_FROM || "support@askseer.ai",
              to: member.email!,
              subject: `You've been added to ${teamName} on Seer`,
              html: createStyledEmailHtml({
                title: "Added to a team",
                subtitle: `${inviter} added you to ${teamName} as ${member.role.toLowerCase()}.`,
                content: "",
                buttonText: "Open Seer",
                buttonUrl:
                  process.env.NEXT_PUBLIC_APP_URL ||
                  process.env.NEXTAUTH_URL ||
                  APP_BASE_URL,
                footerContact: "support@askseer.ai",
              }),
              text: `${inviter} added you to the team ${teamName} on Seer as ${member.role}.`,
            }),
          ),
      );
    } catch (emailError: any) {
      logger.error("Failed to send team member invite email", {
        teamId,
        error: emailError,
      });
    }

    revalidatePath("/teams", "page");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    logger.error("Error adding members to team", { teamId, error });
    throw error;
  }
}

export async function removeTeamMember(teamId: string, userId: string) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/team/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        userId,
        requestedById: user.id,
      }),
    });

    if (!res.ok) {
      let message = "Failed to remove team member";
      let bodyText = "";
      try {
        const body = await res.json();
        if (body?.message) {
          message = body.message;
        }
      } catch (parseError) {
        bodyText = await res.text().catch(() => "");
      }
      const error: any = new Error(message);
      error.status = res.status;
      error.body = (bodyText || "").slice(0, 200);
      throw error;
    }

    revalidatePath("/teams", "page");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    logger.error("Error removing team member", {
      teamId,
      targetUserId: userId,
      status: error?.status,
      body: error?.body,
      error,
    });
    throw error;
  }
}

export async function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: string,
) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/members/role`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          userId,
          role,
          requestedById: user.id,
        }),
      },
    );

    if (!res.ok) {
      let message = "Failed to update team member role";
      let bodyText = "";
      try {
        const body = await res.json();
        if (body?.message) {
          message = body.message;
        }
      } catch (parseError) {
        bodyText = await res.text().catch(() => "");
      }
      const error: any = new Error(message);
      error.status = res.status;
      error.body = (bodyText || "").slice(0, 200);
      throw error;
    }

    revalidatePath("/teams", "page");
    revalidatePath("/settings/company", "page");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    logger.error("Error updating team member role", {
      teamId,
      targetUserId: userId,
      role,
      status: error?.status,
      body: error?.body,
      error,
    });
    throw error;
  }
}

export async function updateCompanyMember(params: {
  companyId: string;
  userId: string;
  role: string;
  canCreatePersonas?: boolean;
}) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  const { companyId, userId, role, canCreatePersonas } = params;
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          userId,
          role,
          invitedById: user.id,
          canCreatePersonas,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to update company member role", {
        companyId,
        targetUserId: userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to update company member role");
    }
    revalidatePath("/settings/company");
    return { success: true };
  } catch (error) {
    logger.error("Error updating company member role", {
      companyId,
      targetUserId: userId,
      error,
    });
    throw error;
  }
}

export async function removeCompanyMember(companyId: string, userId: string) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/members`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          userId,
          requestedById: user.id,
        }),
      },
    );
    if (!res.ok) {
      let message = "Failed to deactivate company member";
      let bodyText = "";
      try {
        const body = await res.json();
        if (body?.message) {
          message = body.message;
        }
      } catch (parseError) {
        bodyText = await res.text().catch(() => "");
      }
      const error: any = new Error(message);
      error.status = res.status;
      error.body = (bodyText || "").slice(0, 200);
      throw error;
    }
    revalidatePath("/settings/company");
    return { success: true };
  } catch (error: any) {
    logger.error("Error deactivating company member", {
      companyId,
      targetUserId: userId,
      status: error?.status,
      body: error?.body,
      error,
    });
    throw error;
  }
}

export async function activateCompanyMember(companyId: string, userId: string) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/members`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          userId,
          requestedById: user.id,
          action: "activate",
        }),
      },
    );
    if (!res.ok) {
      let message = "Failed to activate company member";
      let bodyText = "";
      try {
        const body = await res.json();
        if (body?.message) {
          message = body.message;
        }
      } catch (parseError) {
        bodyText = await res.text().catch(() => "");
      }
      const error: any = new Error(message);
      error.status = res.status;
      error.body = (bodyText || "").slice(0, 200);
      throw error;
    }
    revalidatePath("/settings/company");
    return { success: true };
  } catch (error: any) {
    logger.error("Error activating company member", {
      companyId,
      targetUserId: userId,
      status: error?.status,
      body: error?.body,
      error,
    });
    throw error;
  }
}

export async function deleteCompany(companyId: string) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);

  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/company`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, requestedById: user.id }),
    });

    if (!res.ok) {
      let message = "Failed to delete company";
      let bodyText = "";
      try {
        const body = await res.json();
        if (body?.message) {
          message = body.message;
        }
      } catch (parseError) {
        bodyText = await res.text().catch(() => "");
      }

      const error: any = new Error(message);
      error.status = res.status;
      error.body = (bodyText || "").slice(0, 200);
      throw error;
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    logger.error("Error deleting company", {
      companyId,
      requestedById: user.id,
      status: error?.status,
      body: error?.body,
      error,
    });
    throw error;
  }
}

export async function deleteUserAccount(userId: string) {
  const session = await isAuthenticated();

  if (session.userId !== userId) {
    logger.warn("User attempted to delete another user's account", {
      sessionUserId: session.userId,
      targetUserId: userId,
    });
    redirect("/error");
  }

  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/user`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, requestedById: userId }),
    });

    if (!res.ok) {
      let message = "Failed to delete account";
      let bodyText = "";
      try {
        const body = await res.json();
        if (body?.message) {
          message = body.message;
        }
      } catch (parseError) {
        bodyText = await res.text().catch(() => "");
      }

      const error: any = new Error(message);
      error.status = res.status;
      error.body = (bodyText || "").slice(0, 200);
      throw error;
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    logger.error("Error deleting account", {
      userId,
      status: error?.status,
      body: error?.body,
      error,
    });
    throw error;
  }
}

export async function eraseUser(
  companyId: string,
  userId: string,
  reason?: string,
) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/members/erase`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          userId,
          requestedById: user.id,
          reason,
        }),
      },
    );
    if (!res.ok) {
      let message = "Failed to erase user";
      let teams = undefined;
      let companies = undefined;
      try {
        const body = await res.json();
        if (body?.message) {
          message = body.message;
        }
        if (body?.teams) {
          teams = body.teams;
        }
        if (body?.companies) {
          companies = body.companies;
        }
      } catch (parseError) {
        // Ignore parse errors
      }
      const error: any = new Error(message);
      error.status = res.status;
      error.teams = teams;
      error.companies = companies;
      throw error;
    }
    revalidatePath("/settings/company");
    return { success: true };
  } catch (error: any) {
    logger.error("Error erasing user", {
      companyId,
      targetUserId: userId,
      status: error?.status,
      teams: error?.teams,
      companies: error?.companies,
      error,
    });
    throw error;
  }
}

export async function inviteCompanyMember(
  companyId: string,
  email: string,
  role: string,
  message: string,
  teamIds?: string[],
) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  const { company } = await getCompanyByMyDomain();
  const companyName = company?.name || "your company";
  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/company/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        email,
        role,
        invitedById: user.id,
        teamIds: teamIds || [],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to invite company member", {
        companyId,
        email,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to invite member");
    }
    try {
      const resend = new Resend(process.env.AUTH_RESEND_KEY);
      const inviter = user.name || user.email;
      const htmlMessage = message
        ? `<p style="margin:0 0 16px 0;">${message}</p>`
        : "";
      await resend.emails.send({
        from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
        to: [email],
        subject: `${inviter} invited you to join ${companyName} on Seer`,
        html: createStyledEmailHtml({
          title: "You're invited to join Seer",
          subtitle: `${inviter} invited you to join ${companyName} on Seer`,
          content: htmlMessage,
          buttonText: "Open Seer",
          buttonUrl:
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXTAUTH_URL ||
            "https://askseer.ai",
          footerContact: "support@askseer.ai",
        }),
        text: `${inviter} invited you to join ${companyName} on Seer.\n\n${
          message ? `${message}\n\n` : ""
        }Open Seer: ${
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXTAUTH_URL ||
          "https://askseer.ai"
        }`,
      });
    } catch (emailError: any) {
      logger.error("Failed to send invite email", {
        companyId,
        email,
        error: emailError?.message,
      });
    }
    revalidatePath("/settings/company");
    return { success: true };
  } catch (error) {
    logger.error("Error inviting company member", { companyId, email, error });
    throw error;
  }
}

export async function updateCompanyName(companyId: string, name: string) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/company/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, userId: user.id, name }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to update company name", {
        companyId,
        userId: session.userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to update company name");
    }
    revalidatePath("/account");
    return { success: true };
  } catch (error) {
    logger.error("Error updating company name", {
      companyId,
      userId: session.userId,
      error,
    });
    throw error;
  }
}

export async function updateCompanyLogo(
  companyId: string,
  logoKey: string | null,
) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/company/logo`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, userId: user.id, logoKey }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to update company image", {
        companyId,
        userId: session.userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to update company image");
    }
    revalidatePath("/account");
    return { success: true };
  } catch (error) {
    logger.error("Error updating company image", {
      companyId,
      userId: session.userId,
      error,
    });
    throw error;
  }
}

export async function updateCompanyAutoEnroll(
  companyId: string,
  autoEnroll: boolean,
) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/company/join`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, userId: user.id, autoEnroll }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to update company join settings", {
        companyId,
        userId: session.userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to update company join settings");
    }
    revalidatePath("/settings/company");
    return { success: true };
  } catch (error) {
    logger.error("Error updating company join settings", {
      companyId,
      userId: session.userId,
      error,
    });
    throw error;
  }
}

export async function updateCompanyPersonalTeams(
  companyId: string,
  disablePersonalTeams: boolean,
) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/personal-teams`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          userId: user.id,
          disablePersonalTeams,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to update company personal team settings", {
        companyId,
        userId: session.userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to update personal team settings");
    }
    revalidatePath("/settings/company");
    revalidatePath("/company");
    return { success: true };
  } catch (error) {
    logger.error("Error updating company personal team settings", {
      companyId,
      userId: session.userId,
      error,
    });
    throw error;
  }
}

export async function getDomainUsersForCompany(
  companyId: string,
  domain: string,
) {
  const session = await isAuthenticated();
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/company/domain-users?companyId=${encodeURIComponent(
        companyId,
      )}&domain=${encodeURIComponent(domain)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to fetch domain users", {
        companyId,
        domain,
        userId: session.userId,
        status: res.status,
      });
      throw new Error("Failed to fetch domain users");
    }
    const { data } = await res.json();
    return data || [];
  } catch (error) {
    logger.error("Error fetching domain users", {
      companyId,
      domain,
      userId: session.userId,
      error,
    });
    throw error;
  }
}

export async function enrollDomainUsers(companyId: string, userIds: string[]) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);
  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/company/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        userIds,
        invitedById: user.id,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to enroll domain users", {
        companyId,
        userId: session.userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to enroll domain users");
    }
    revalidatePath("/settings/company");
    return { success: true };
  } catch (error) {
    logger.error("Error enrolling domain users", {
      companyId,
      userId: session.userId,
      userIds: userIds.length,
      error,
    });
    throw error;
  }
}

export async function consumeTeamCreditByStudy(
  studyId: string,
  byUserId: string,
) {
  logger.debug("Consuming team credit by study", { studyId, byUserId });
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/team/credits/consume`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyId, byUserId }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("Failed to consume team credit", {
      studyId,
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error("Failed to consume team credit");
  }
  const { data } = await res.json();
  logger.info("Team credit consumed", { studyId, teamId: data?.teamId });

  // Trigger auto-refill check asynchronously (don't wait for it)
  if (data?.teamId) {
    triggerAutoRefillCheck(data.teamId).catch((error) => {
      logger.warn("Failed to trigger auto-refill check", {
        teamId: data.teamId,
        error: error?.message,
      });
    });
  }

  return data;
}

/**
 * Trigger an auto-refill check for a team.
 * This is called asynchronously after credit consumption.
 */
async function triggerAutoRefillCheck(teamId: string): Promise<void> {
  try {
    // Import dynamically to avoid circular dependencies
    const { triggerAutoRefill } =
      await import("@/apps/nextjs-app/lib/actions/credit-actions");
    const result = await triggerAutoRefill(teamId);

    if (result.success && result.data?.triggered) {
      logger.info("Auto-refill triggered successfully", {
        teamId,
        credits: result.data.credits,
      });
    }
  } catch (error) {
    logger.warn("Error triggering auto-refill", { teamId, error });
  }
}

export async function addTeamCredits(params: {
  teamId: string;
  credits: number;
  byUserId: string;
  reason: string;
}) {
  const { teamId, credits, byUserId, reason } = params;
  logger.debug("Adding credits to team", { teamId, credits, byUserId, reason });

  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/team/credits/adjust`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        delta: credits,
        byUserId,
        reason,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("Failed to add team credits", {
      teamId,
      credits,
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error("Failed to add team credits");
  }

  const { data } = await res.json();
  logger.info("Team credits added", {
    teamId,
    credits,
    newBalance: data?.credits,
  });
  return data;
}

// ============================================================================
// Team Auto-Refill & Payment Method Data Access
// ============================================================================

export interface TeamAutoRefillSettings {
  id: string;
  name: string;
  credits: number;
  autoRefillEnabled: boolean;
  autoRefillThreshold: number | null;
  autoRefillAmount: number | null;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
}

export interface TeamAutoRefillStatus {
  needsRefill: boolean;
  team: {
    id: string;
    name: string;
    companyId: string | null;
    stripeCustomerId: string;
    stripePaymentMethodId: string;
    autoRefillAmount: number;
    autoRefillUpdatedById: string | null;
  } | null;
}

/**
 * Get auto-refill settings for a team
 */
export async function getTeamAutoRefillSettings(
  teamId: string,
  userId: string,
): Promise<TeamAutoRefillSettings | null> {
  logger.debug("Getting team auto-refill settings", { teamId, userId });

  const result = await dbFetch<TeamAutoRefillSettings>(
    `/api/team/auto-refill?teamId=${teamId}&userId=${userId}`,
  );

  if (!result.ok) {
    logger.error("Failed to fetch team auto-refill settings", {
      teamId,
      userId,
      error: result.error,
    });
    return null;
  }

  return result.data;
}

/**
 * Update auto-refill settings for a team
 */
export async function updateTeamAutoRefillSettings(params: {
  teamId: string;
  userId: string;
  autoRefillEnabled: boolean;
  autoRefillThreshold: number | null;
  autoRefillAmount: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const {
    teamId,
    userId,
    autoRefillEnabled,
    autoRefillThreshold,
    autoRefillAmount,
  } = params;
  logger.debug("Updating team auto-refill settings", {
    teamId,
    userId,
    autoRefillEnabled,
  });

  const result = await dbFetch<void>("/api/team/auto-refill", {
    method: "POST",
    body: JSON.stringify({
      teamId,
      userId,
      autoRefillEnabled,
      autoRefillThreshold,
      autoRefillAmount,
    }),
  });

  if (!result.ok) {
    logger.error("Failed to update team auto-refill settings", {
      teamId,
      userId,
      error: result.error,
    });
    return { ok: false, error: result.error };
  }

  logger.info("Team auto-refill settings updated", {
    teamId,
    userId,
    autoRefillEnabled,
  });
  return { ok: true };
}

/**
 * Get auto-refill status (whether team needs a refill)
 */
export async function getTeamAutoRefillStatus(
  teamId: string,
): Promise<TeamAutoRefillStatus | null> {
  logger.debug("Getting team auto-refill status", { teamId });

  const result = await dbFetch<TeamAutoRefillStatus>(
    `/api/team/auto-refill/status?teamId=${teamId}`,
  );

  if (!result.ok) {
    logger.warn("Failed to fetch team auto-refill status", {
      teamId,
      error: result.error,
    });
    return null;
  }

  return result.data;
}

/**
 * Save a payment method to a team
 */
export async function saveTeamPaymentMethod(params: {
  teamId: string;
  userId: string;
  stripePaymentMethodId: string;
  paymentMethodLast4: string;
  paymentMethodBrand: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { teamId, userId } = params;
  logger.debug("Saving team payment method", { teamId, userId });

  const result = await dbFetch<void>("/api/team/payment-method", {
    method: "POST",
    body: JSON.stringify(params),
  });

  if (!result.ok) {
    logger.error("Failed to save team payment method", {
      teamId,
      userId,
      error: result.error,
    });
    return { ok: false, error: result.error };
  }

  logger.info("Team payment method saved", { teamId, userId });
  return { ok: true };
}

/**
 * Remove a payment method from a team
 */
export async function removeTeamPaymentMethod(
  teamId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  logger.debug("Removing team payment method", { teamId, userId });

  const result = await dbFetch<void>("/api/team/payment-method", {
    method: "DELETE",
    body: JSON.stringify({ teamId, userId }),
  });

  if (!result.ok) {
    logger.error("Failed to remove team payment method", {
      teamId,
      userId,
      error: result.error,
    });
    return { ok: false, error: result.error };
  }

  logger.info("Team payment method removed", { teamId, userId });
  return { ok: true };
}

/**
 * Save Stripe customer ID to a team
 */
export async function saveTeamStripeCustomerId(
  teamId: string,
  userId: string,
  stripeCustomerId: string,
): Promise<{ ok: boolean; error?: string }> {
  logger.debug("Saving team Stripe customer ID", { teamId, userId });

  const result = await dbFetch<void>("/api/team/stripe-customer", {
    method: "POST",
    body: JSON.stringify({ teamId, userId, stripeCustomerId }),
  });

  if (!result.ok) {
    logger.error("Failed to save team Stripe customer ID", {
      teamId,
      userId,
      error: result.error,
    });
    return { ok: false, error: result.error };
  }

  logger.info("Team Stripe customer ID saved", { teamId, userId });
  return { ok: true };
}

export async function updateStudyTeam(
  studyId: string,
  teamId: string,
  byUserId: string,
) {
  logger.debug("Updating study team", { studyId, teamId, byUserId });
  const res = await fetch(`${process.env.DB_WORKER_URL}/api/study/team`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studyId, teamId, byUserId }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    let message = "Failed to update study team";
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed?.message) {
        message = parsed.message;
      }
    } catch (e) {
      if (bodyText) {
        message = bodyText;
      }
    }
    logger.error("Failed to update study team", {
      studyId,
      teamId,
      byUserId,
      status: res.status,
      body: bodyText.slice(0, 200),
    });
    const error = new Error(message);
    (error as any).status = res.status;
    throw error;
  }

  const { data } = await res.json();
  logger.info("Study team updated", { studyId, teamId, byUserId });
  return data;
}

export async function updateStudyVisibility(
  studyId: string,
  visibility: string,
  userId: string,
) {
  logger.debug("Updating study visibility", { studyId, visibility, userId });
  const res = await fetch(`${process.env.DB_WORKER_URL}/api/study/visibility`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studyId, visibility, userId }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    let message = "Failed to update study visibility";
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed?.message) {
        message = parsed.message;
      }
    } catch (e) {
      if (bodyText) {
        message = bodyText;
      }
    }
    logger.error("Failed to update study visibility", {
      studyId,
      visibility,
      userId,
      status: res.status,
      body: bodyText.slice(0, 200),
    });
    const error = new Error(message);
    (error as any).status = res.status;
    throw error;
  }

  const { data } = await res.json();
  logger.info("Study visibility updated", { studyId, visibility, userId });
  revalidatePath(`/studies`);
  revalidatePath(`/studies/${studyId}`);
  return data;
}

export async function regenerateStudyShareToken(
  studyId: string,
  userId: string,
) {
  logger.debug("Regenerating study share token", { studyId, userId });
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/study/regenerate-share-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyId, userId }),
    },
  );

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    logger.error("Failed to regenerate study share token", {
      studyId,
      userId,
      status: res.status,
      body: bodyText.slice(0, 200),
    });
    throw new Error("Failed to regenerate share token");
  }

  const { data } = await res.json();
  logger.info("Study share token regenerated", { studyId, userId });
  return data;
}

export async function toggleStudyShareLink(
  studyId: string,
  userId: string,
  enabled: boolean,
): Promise<{ shareToken: string | null }> {
  logger.debug("Toggling study share link", { studyId, userId, enabled });
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/study/toggle-share-link`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyId, userId, enabled }),
    },
  );

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    logger.error("Failed to toggle study share link", {
      studyId,
      userId,
      enabled,
      status: res.status,
      body: bodyText.slice(0, 200),
    });
    throw new Error("Failed to toggle share link");
  }

  const { data } = await res.json();
  logger.info("Study share link toggled", { studyId, userId, enabled });
  return data;
}

export async function getStudyByShareToken(token: string) {
  logger.debug("Getting study by share token", { token });
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/study/shared?token=${encodeURIComponent(token)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    if (res.status === 404) {
      logger.info("Study not found by share token", { token });
      return null;
    }
    logger.error("Failed to get study by share token", {
      token,
      status: res.status,
    });
    throw new Error("Failed to get shared study");
  }

  const { data } = await res.json();
  logger.info("Successfully fetched study by share token", {
    studyId: data?.id,
  });
  return data;
}

export async function getStudyShareInfo(studyId: string, userId: string) {
  logger.debug("Getting study share info", { studyId, userId });
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/study/share-info?studyId=${encodeURIComponent(studyId)}&userId=${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    // If user is not authorized to view share info, return null
    // This allows the page to load and the Share button will just not be shown
    if (res.status === 403) {
      logger.debug("User not authorized to view study share info", {
        studyId,
        userId,
      });
      return null;
    }
    const bodyText = await res.text().catch(() => "");
    logger.error("Failed to get study share info", {
      studyId,
      userId,
      status: res.status,
      body: bodyText.slice(0, 200),
    });
    throw new Error("Failed to get study share info");
  }

  const { data } = await res.json();
  logger.info("Successfully fetched study share info", { studyId, userId });
  return data;
}

// Get public redirect info for a study (no auth required)
// Returns the share token if the study is PUBLIC, or null otherwise
export async function getStudyPublicRedirectInfo(
  studyId: string,
): Promise<{ id: string; shareToken: string } | null> {
  logger.debug("Getting study public redirect info", { studyId });
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/public-redirect?studyId=${encodeURIComponent(studyId)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      if (res.status === 404) {
        logger.info("Study not found or not public", { studyId });
        return null;
      }
      logger.error("Failed to get study public redirect info", {
        studyId,
        status: res.status,
      });
      return null;
    }

    const { data } = await res.json();
    logger.info("Successfully fetched study public redirect info", {
      studyId,
    });
    return data;
  } catch (error) {
    logger.error("Error fetching study public redirect info", {
      studyId,
      error,
    });
    return null;
  }
}

export async function updateStudyName(
  userId: string,
  studyId: string,
  name: string,
) {
  logger.debug("Updating study name", { userId, studyId, name });

  let session = await isAuthenticated();

  // A user cannot update another users study
  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's study name", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/name`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studyId: studyId,
          name: name,
          userId: userId,
        }),
      },
    );

    if (!response.ok) {
      logger.error("Failed to update study name", {
        userId,
        studyId,
        name,
        status: response.status,
      });
      throw new Error(`Failed to update study name: ${response.status}`);
    }

    logger.info("Study name updated successfully", { userId, studyId, name });
    revalidatePath(`/studies`);
  } catch (error) {
    logger.error("Error updating study name", { userId, studyId, name, error });
    throw error;
  }
}

export async function deleteStudy(studyId: string, userId: string) {
  logger.debug("Deleting study", { studyId, userId });

  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to delete another user's study", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
    });
    redirect("/error");
  }

  try {
    // Delete a study for the user
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`,
      {
        method: "DELETE",
      },
    );
    const { success } = await response.json();

    // If data does not exist there is a problem
    if (!success) {
      logger.error("Failed to delete study", { studyId, userId });
      redirect("/error");
    }

    logger.info("Study deleted successfully", { studyId, userId });
  } catch (error) {
    logger.error("Error deleting study", { studyId, userId, error });
    redirect("/error");
  }
}

/**
 * Delete a study without redirecting on error.
 * Returns true if successful, false otherwise.
 * Use this for cleanup operations where errors should be handled silently.
 */
export async function deleteStudySilent(
  studyId: string,
  userId: string,
): Promise<boolean> {
  logger.debug("Deleting study (silent)", { studyId, userId });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      logger.error("Failed to delete study (silent)", {
        studyId,
        userId,
        status: response.status,
      });
      return false;
    }

    const { success } = await response.json();
    if (!success) {
      logger.error("Delete study returned unsuccessful (silent)", {
        studyId,
        userId,
      });
      return false;
    }

    logger.info("Study deleted successfully (silent)", { studyId, userId });
    return true;
  } catch (error) {
    logger.error("Error deleting study (silent)", {
      studyId,
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export async function getCognitiveWalkthrough(id: string, userId: string) {
  logger.debug("Getting cognitive walkthrough data", { studyId: id, userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn(
      "User attempted to access another user's cognitive walkthrough",
      {
        sessionUserId: session.userId,
        requestedUserId: userId,
        studyId: id,
      },
    );
    return null;
  }

  try {
    // Get cognitive walkthrough data from the db-worker
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/cognitiveWalkthrough?studyId=${id}&userId=${userId}`,
      {
        cache: "no-store",
      },
    );
    const { data: cognitiveWalkthrough } = await response.json();

    // If data does not exist, return null so the page can handle it
    if (!cognitiveWalkthrough) {
      logger.warn("Cognitive walkthrough not found or access denied", {
        studyId: id,
        userId,
      });
      return null;
    }

    logger.info("Cognitive walkthrough data retrieved successfully", {
      studyId: id,
      userId,
    });
    return cognitiveWalkthrough;
  } catch (error) {
    logger.error("Error fetching cognitive walkthrough data", {
      studyId: id,
      userId,
      error,
    });
    return null;
  }
}

export async function getHeuristicEvaluation(id: string, userId: string) {
  logger.debug("Getting heuristic evaluation data", { studyId: id, userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn(
      "User attempted to access another user's heuristic evaluation",
      {
        sessionUserId: session.userId,
        requestedUserId: userId,
        studyId: id,
      },
    );
    return null;
  }

  try {
    // Get heuristic evaluation data from the db-worker
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/heuristicEvaluation?studyId=${id}&userId=${userId}`,
      {
        cache: "no-store",
      },
    );
    const { data: heuristicEvaluation } = await response.json();

    // If data does not exist, return null so the page can handle it
    if (!heuristicEvaluation) {
      logger.warn("Heuristic evaluation not found or access denied", {
        studyId: id,
        userId,
      });
      return null;
    }

    logger.info("Heuristic evaluation data retrieved successfully", {
      studyId: id,
      userId,
    });
    return heuristicEvaluation;
  } catch (error) {
    logger.error("Error fetching heuristic evaluation data", {
      studyId: id,
      userId,
      error,
    });
    return null;
  }
}

export async function getPersona(id: string, userId: string) {
  logger.debug("Getting persona data", { studyId: id, userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's persona", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId: id,
    });
    return null;
  }

  try {
    // Get persona data from the db-worker
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/persona?studyId=${id}&userId=${userId}`,
      {
        cache: "no-store",
      },
    );
    const { data: persona } = await response.json();

    // If data does not exist, return null so the page can handle it
    if (!persona) {
      logger.warn("Persona not found or access denied", {
        studyId: id,
        userId,
      });
      return null;
    }

    logger.info("Persona data retrieved successfully", {
      studyId: id,
      userId,
    });
    return persona;
  } catch (error) {
    logger.error("Error fetching persona data", {
      studyId: id,
      userId,
      error,
    });
    return null;
  }
}

/**
 * Fetches basic persona info (name, description, photo) without access checks.
 * This is used to display persona info on studies even when the user doesn't
 * have full access to the persona itself.
 * Returns null if persona is not found (does not redirect).
 */
export async function getPersonaBasicInfo(studyId: string): Promise<{
  id: string;
  name: string | null;
  description: string | null;
  photoKey: string | null;
} | null> {
  logger.debug("Getting persona basic info", { studyId });

  await isAuthenticated();

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/persona/basic?studyId=${studyId}`,
    );
    const { data } = await response.json();

    logger.debug("Persona basic info retrieved", {
      studyId,
      found: !!data,
    });
    return data ?? null;
  } catch (error) {
    logger.error("Error fetching persona basic info", {
      studyId,
      error,
    });
    return null;
  }
}

export async function listPersonas(userId: string, teamId: string) {
  logger.debug("Listing personas for user", { userId, teamId });
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's personas", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }
  try {
    const params = new URLSearchParams({ userId, teamId });
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/personas?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to list personas", {
        userId,
        teamId,
        status: res.status,
      });
      redirect("/error");
    }
    const { data } = await res.json();
    logger.info("Personas retrieved successfully", {
      userId,
      teamId,
      count: data?.length || 0,
    });
    return data;
  } catch (error) {
    logger.error("Error listing personas", { userId, teamId, error });
    redirect("/error");
  }
}

export async function getPersonaVersions(
  personaGroupId: string,
  userId: string,
) {
  logger.debug("Getting persona versions", { personaGroupId, userId });
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's persona versions", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }
  try {
    const params = new URLSearchParams({ userId });
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/persona/versions/${personaGroupId}?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to get persona versions", {
        personaGroupId,
        userId,
        status: res.status,
      });
      redirect("/error");
    }
    const { data } = await res.json();
    logger.info("Persona versions retrieved successfully", {
      personaGroupId,
      userId,
      count: data?.length || 0,
    });
    return data;
  } catch (error) {
    logger.error("Error getting persona versions", {
      personaGroupId,
      userId,
      error,
    });
    redirect("/error");
  }
}

export async function updatePersonaData(
  studyId: string,
  userId: string,
  data: any,
) {
  logger.debug("Updating persona", { studyId, userId });
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's persona", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }
  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/persona/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studyId,
        userId,
        data,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      logger.error("Failed to update persona", {
        studyId,
        userId,
        status: res.status,
      });
      throw new Error("Failed to update persona");
    }
    const result = await res.json();
    logger.info("Persona updated successfully", {
      studyId,
      userId,
      newStudyId: result.data?.study?.id,
      version: result.data?.persona?.version,
    });
    return result.data;
  } catch (error) {
    logger.error("Error updating persona", {
      studyId,
      userId,
      error,
    });
    throw error;
  }
}

export async function listHeuristicFamilies(companyId: string | null) {
  const session = await isAuthenticated();
  logger.debug("Listing heuristic families for company", {
    companyId,
    userId: session.userId,
  });
  try {
    const params = new URLSearchParams();
    if (companyId) {
      params.set("companyId", companyId);
    }
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/heuristic-families?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to list heuristic families", {
        companyId,
        userId: session.userId,
        status: res.status,
      });
      redirect("/error");
    }
    const { data } = await res.json();
    logger.info("Heuristic families retrieved successfully", {
      companyId,
      userId: session.userId,
      count: data?.length || 0,
    });
    return data;
  } catch (error) {
    logger.error("Error listing heuristic families", {
      companyId,
      userId: session.userId,
      error,
    });
    redirect("/error");
  }
}

// ==========================================
// Heuristic Data Functions
// ==========================================

interface CreateHeuristicFamilyData {
  name: string;
  key: string;
  description?: string;
  companyId: string;
  userId: string;
}

interface CreateHeuristicData {
  heuristicFamilyId: string;
  label: string;
  category?: string;
  heuristic: string;
  description?: string;
  companyId: string;
  userId: string;
}

interface CreateHeuristicExampleData {
  heuristicId: string;
  title?: string;
  example: string;
  createdById: string;
}

export async function createHeuristicFamilyData(
  params: CreateHeuristicFamilyData,
) {
  const result = await dbFetch<{ id: string }>("/api/heuristic-families", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!result.ok) {
    throw new Error(result.error || "Failed to create heuristic family");
  }
  return result.data;
}

export async function createHeuristicData(params: CreateHeuristicData) {
  const result = await dbFetch<{ id: string }>("/api/heuristics", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!result.ok) {
    throw new Error(result.error || "Failed to create heuristic");
  }
  return result.data;
}

export async function updateHeuristicFamilyData(
  familyId: string,
  params: Partial<CreateHeuristicFamilyData>,
) {
  const result = await dbFetch<{ id: string }>(
    `/api/heuristic-families/${familyId}`,
    {
      method: "PATCH",
      body: JSON.stringify(params),
    },
  );
  if (!result.ok) {
    throw new Error(result.error || "Failed to update heuristic family");
  }
  return result.data;
}

export async function deleteHeuristicFamilyData(
  familyId: string,
  companyId: string,
  userId: string,
) {
  const result = await dbFetch<void>(`/api/heuristic-families/${familyId}`, {
    method: "DELETE",
    body: JSON.stringify({ companyId, userId }),
  });
  if (!result.ok) {
    throw new Error(result.error || "Failed to delete heuristic family");
  }
}

export async function toggleHeuristicFamilyVisibilityData(
  familyId: string,
  companyId: string,
  isHidden: boolean,
  userId: string,
) {
  const result = await dbFetch<void>(
    `/api/heuristic-families/${familyId}/visibility`,
    {
      method: "POST",
      body: JSON.stringify({ companyId, isHidden, userId }),
    },
  );
  if (!result.ok) {
    throw new Error(
      result.error || "Failed to toggle heuristic family visibility",
    );
  }
}

export async function getHeuristicById(heuristicId: string) {
  const result = await dbFetch<{
    id: string;
    family?: { companyId: string | null };
  }>(`/api/heuristics/${heuristicId}`, {
    method: "GET",
  });
  if (!result.ok) {
    throw new Error(result.error || "Heuristic not found");
  }
  return result.data;
}

export async function getCompanyWithUsers(userId: string, companyId: string) {
  const result = await dbFetch<{
    companyUsers?: Array<{ userId: string; role: string }>;
  }>(`/api/company?userId=${userId}&companyId=${companyId}`, {
    method: "GET",
  });
  if (!result.ok) {
    throw new Error(result.error || "Company not found");
  }
  return result.data;
}

export async function createHeuristicExampleData(
  params: CreateHeuristicExampleData,
) {
  const result = await dbFetch<{ id: string }>("/api/heuristic-examples", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!result.ok) {
    throw new Error(result.error || "Failed to create heuristic example");
  }
  return result.data;
}

export async function getStudy(
  studyId: string,
  userId: string,
  type: StudyType,
) {
  logger.debug("Getting study data", { studyId, userId, type });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's study", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
      type,
    });
    redirect("/error");
  }

  try {
    // Get a study for the user
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`,
    );
    const { data: study } = await response.json();

    // If data does not exist there is a problem
    if (!study) {
      logger.error("Study not found", { studyId, userId, type });
      redirect("/error");
    }

    logger.info("Study data retrieved successfully", { studyId, userId, type });
    return study;
  } catch (error) {
    logger.error("Error fetching study data", { studyId, userId, type, error });
    redirect("/error");
  }
}

/**
 * Check if the current user has access to a study based on visibility settings.
 * Unlike getStudy, this does not redirect on error and returns a simple boolean.
 * Use this to check access to a persona or other study without navigating away.
 */
export async function canAccessStudy(
  studyId: string,
  userId: string,
): Promise<boolean> {
  logger.debug("Checking study access", { studyId, userId });

  const session = await isAuthenticated();

  // A user cannot check another user's access
  if (session.userId !== userId) {
    logger.warn("User attempted to check another user's study access", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
    });
    return false;
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/access?studyId=${studyId}&userId=${userId}`,
    );
    const { data } = await response.json();

    logger.debug("Study access check completed", {
      studyId,
      userId,
      hasAccess: data?.hasAccess ?? false,
    });
    return data?.hasAccess ?? false;
  } catch (error) {
    logger.error("Error checking study access", { studyId, userId, error });
    return false;
  }
}

export async function getStudies(
  userId: string,
  options: { type?: StudyType | null; teamId?: string | null } = {},
) {
  const { type = null, teamId = null } = options;
  logger.debug("Getting all studies for user", { userId, type, teamId });

  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's studies", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      type,
    });
    redirect("/error");
  }

  try {
    // Get all studies for the user
    const params = new URLSearchParams({ userId });
    if (teamId) {
      params.set("teamId", teamId);
    }
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studies?${params.toString()}`,
      {
        cache: "no-store", // Always fetch fresh studies data
      },
    );
    const { data: studies } = await response.json();

    logger.info("Studies retrieved successfully", {
      userId,
      type,
      teamId,
      studyCount: studies?.length || 0,
    });
    return studies;
  } catch (error) {
    logger.error("Error fetching studies", { userId, type, teamId, error });
    redirect("/error");
  }
}

// Bookmarked Studies Functions

export async function getBookmarkedStudyIds(userId: string): Promise<string[]> {
  logger.debug("Getting bookmarked study IDs for user", { userId });

  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's bookmarked studies", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/bookmarked-studies?userId=${userId}`,
      { cache: "no-store" },
    );
    const { data } = await response.json();
    logger.info("Bookmarked study IDs retrieved successfully", {
      userId,
      count: data?.length || 0,
    });
    return data || [];
  } catch (error) {
    logger.error("Error fetching bookmarked study IDs", { userId, error });
    return [];
  }
}

export async function toggleStudyBookmark(
  userId: string,
  studyId: string,
): Promise<{ success: boolean; isBookmarked: boolean }> {
  logger.debug("Toggling study bookmark", { userId, studyId });

  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to toggle bookmark for another user", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    return { success: false, isBookmarked: false };
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/toggle-bookmark`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, studyId }),
      },
    );
    const result = await response.json();

    if (result.success) {
      revalidatePath("/studies");
      revalidatePath(`/evaluation/${studyId}`);
      revalidatePath(`/walkthrough/${studyId}`);
      revalidatePath(`/persona/${studyId}`);
      logger.info("Study bookmark toggled successfully", {
        userId,
        studyId,
        isBookmarked: result.data?.isBookmarked,
      });
    }

    return {
      success: result.success,
      isBookmarked: result.data?.isBookmarked ?? false,
    };
  } catch (error) {
    logger.error("Error toggling study bookmark", { userId, studyId, error });
    return { success: false, isBookmarked: false };
  }
}

export async function postStudy(jobData: any) {
  // Accept legacy shape and convert to v2 envelope required by DB worker
  let envelope: any;
  if (jobData?.version === 2) {
    envelope = jobData;
  } else {
    const d = jobData?.data || {};
    const task = (
      jobData?.type ||
      jobData?.task ||
      d?.type ||
      ""
    ).toLowerCase();
    const base = {
      name: d?.name,
      goal: d?.goal,
      user: d?.user ?? null,
      context: d?.context ?? null,
      files: Array.isArray(d?.files) ? d.files : [],
    };
    envelope =
      task === "heuristic_evaluation"
        ? {
            version: 2,
            studyId: jobData?.studyId,
            userId: d?.userId,
            type: task,
            payload: { ...base, heuristic: (d?.heuristic || "").toUpperCase() },
          }
        : {
            version: 2,
            studyId: jobData?.studyId,
            userId: d?.userId,
            type: task,
            payload: { ...base },
          };
  }

  logger.debug("Creating new study (v2)", {
    userId: envelope?.userId,
    studyType: envelope?.type,
  });

  const session = await isAuthenticated();
  if (session.userId !== envelope.userId) {
    logger.warn("User attempted to create study for another user", {
      sessionUserId: session.userId,
      requestedUserId: envelope.userId,
    });
    redirect("/error");
  }

  // Validate v2 envelope before sending (shared parser)
  let parsedEnvelope: any;
  try {
    parsedEnvelope = parseJobEnvelope(envelope);
  } catch (error) {
    logger.error("Invalid jobData for postStudy (v2)", {
      error: (error as Error)?.message,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(`${process.env.DB_WORKER_URL}/api/study`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedEnvelope),
    });
    const { data: study } = await response.json();
    if (!study) {
      logger.error("Failed to create study", {
        userId: envelope?.userId,
        studyType: envelope?.type,
      });
      redirect("/error");
    }
    logger.info("Study created successfully", {
      userId: envelope?.userId,
      studyType: envelope?.type,
      studyId: study?.id,
    });
    return study;
  } catch (error) {
    logger.error("Error creating study", {
      userId: envelope?.userId,
      studyType: envelope?.type,
      error,
    });
    redirect("/error");
  }
}

export async function updateAttempts(studyId: string) {
  logger.debug("Updating study attempts", { studyId });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studyAttempts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId }),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    logger.info("Study attempts updated successfully", {
      studyId,
      newAttempts: data.attempts,
    });
    return data;
  } catch (error) {
    logger.error("Error updating number of study attempts", { studyId, error });
    throw error;
  }
}

export async function updateStatus(studyId: string, status: string) {
  logger.debug("Updating study status", { studyId, status });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studyStatus`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId, status: status }),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    logger.info("Study status updated successfully", { studyId, status });
    return data;
  } catch (error) {
    logger.error("Error updating study status", { studyId, status, error });
    throw error;
  }
}

export async function updateStudyContent(
  id: string,
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  type: "issue" | "recommendation",
  content: string,
) {
  const session = await isAuthenticated();

  logger.debug("Updating study content", {
    id,
    studyType,
    type,
    userId: session.userId,
    contentLength: content.length,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/${type}s/${id}`;
  const requestBody =
    type === "issue"
      ? { issue: content, userId: session.userId }
      : { recommendation: content, userId: session.userId };

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      logger.error("Failed to update study content", {
        id,
        studyType,
        type,
        endpoint,
        status: response.status,
      });
      throw new Error("Failed to update content");
    }

    const data = await response.json();
    logger.info("Study content updated successfully", { id, studyType, type });
    return data;
  } catch (error) {
    logger.error("Error updating study content", {
      id,
      studyType,
      type,
      error,
    });
    throw error;
  }
}

export async function updateStudyContentRating(
  id: string,
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  type: "issue" | "recommendation",
  rating?: "up" | "down" | null,
) {
  const session = await isAuthenticated();

  logger.debug("Updating study content rating", {
    id,
    studyType,
    type,
    userId: session.userId,
    rating,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/${type}s/${id}`;
  const requestBody: Record<string, any> = { userId: session.userId };

  if (rating !== undefined) {
    requestBody.rating = rating ? rating.toUpperCase() : null;
  }

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      logger.error("Failed to update study content rating", {
        id,
        studyType,
        type,
        endpoint,
        status: response.status,
      });
      throw new Error("Failed to update rating");
    }

    const data = await response.json();
    logger.info("Study content rating updated successfully", {
      id,
      studyType,
      type,
    });
    return data;
  } catch (error) {
    logger.error("Error updating study content rating", {
      id,
      studyType,
      type,
      error,
    });
    throw error;
  }
}

export async function deleteStudyContent(
  id: string,
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  type: "issue" | "recommendation",
) {
  const session = await isAuthenticated();

  logger.debug("Deleting study content", {
    id,
    studyType,
    type,
    userId: session.userId,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/${type}s/${id}`;

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: session.userId }),
    });

    if (!response.ok) {
      logger.error("Failed to delete study content", {
        id,
        studyType,
        type,
        endpoint,
        status: response.status,
      });
      throw new Error("Failed to delete content");
    }

    const data = await response.json();
    logger.info("Study content deleted successfully", { id, studyType, type });
    return data;
  } catch (error) {
    logger.error("Error deleting study content", {
      id,
      studyType,
      type,
      error,
    });
    throw error;
  }
}

export async function updateIssueSeverity(
  id: string,
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  severity: number,
) {
  const session = await isAuthenticated();

  logger.debug("Updating issue severity", {
    id,
    studyType,
    severity,
    userId: session.userId,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/issues/${id}`;

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ severity, userId: session.userId }),
    });

    if (!response.ok) {
      logger.error("Failed to update issue severity", {
        id,
        studyType,
        severity,
        endpoint,
        status: response.status,
      });
      throw new Error("Failed to update severity");
    }

    const data = await response.json();
    logger.info("Issue severity updated successfully", {
      id,
      studyType,
      severity,
    });
    return data;
  } catch (error) {
    logger.error("Error updating issue severity", {
      id,
      studyType,
      severity,
      error,
    });
    throw error;
  }
}

export async function createRecommendation(
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  parentId: string, // issueId or resultId
  recommendation: string,
  source: string,
) {
  const session = await isAuthenticated();

  logger.debug("Creating recommendation", {
    studyType,
    parentId,
    source,
    userId: session.userId,
    recommendationLength: recommendation.length,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/recommendations`;
  const body =
    studyType === "cognitiveWalkthrough"
      ? { issueId: parentId, recommendation, source, userId: session.userId }
      : { resultId: parentId, recommendation, source, userId: session.userId };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error("Failed to create recommendation", {
        studyType,
        parentId,
        source,
        endpoint,
        status: response.status,
      });
      throw new Error("Failed to create recommendation");
    }

    const data = await response.json();
    logger.info("Recommendation created successfully", {
      studyType,
      parentId,
      source,
      recommendationId: data?.id,
    });
    return data;
  } catch (error) {
    logger.error("Error creating recommendation", {
      studyType,
      parentId,
      source,
      error,
    });
    throw error;
  }
}

export async function createHEResult(
  heuristicEvaluationId: string,
  heuristicId: string,
  step: number,
  fileId: string,
  reason: string,
  severity: number,
  source: string,
) {
  const session = await isAuthenticated();

  logger.debug("Creating heuristic evaluation result", {
    heuristicEvaluationId,
    heuristicId,
    step,
    fileId,
    source,
    userId: session.userId,
    reasonLength: reason.length,
    severity,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/heuristicEvaluation/results`;
  const body = {
    heuristicEvaluationId,
    heuristicId,
    step,
    fileId,
    reason,
    severity,
    source,
    userId: session.userId,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error("Failed to create heuristic evaluation result", {
        heuristicEvaluationId,
        heuristicId,
        step,
        fileId,
        source,
        status: response.status,
      });
      throw new Error("Failed to create heuristic evaluation issue");
    }

    const data = await response.json();
    logger.info("Heuristic evaluation result created successfully", {
      heuristicEvaluationId,
      heuristicId,
      step,
      fileId,
      source,
      resultId: data?.id,
    });
    return data;
  } catch (error) {
    logger.error("Error creating heuristic evaluation result", {
      heuristicEvaluationId,
      heuristicId,
      step,
      fileId,
      source,
      error,
    });
    throw error;
  }
}

export async function createCWIssue(
  stepId: string,
  issueType: string,
  issue: string,
  source: string,
) {
  const session = await isAuthenticated();

  logger.debug("Creating cognitive walkthrough issue", {
    stepId,
    issueType,
    source,
    userId: session.userId,
    issueLength: issue.length,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/cognitiveWalkthrough/issues`;
  const body = { stepId, issueType, issue, source, userId: session.userId };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error("Failed to create cognitive walkthrough issue", {
        stepId,
        issueType,
        source,
        status: response.status,
      });
      throw new Error("Failed to create cognitive walkthrough issue");
    }

    const data = await response.json();
    logger.info("Cognitive walkthrough issue created successfully", {
      stepId,
      issueType,
      source,
      issueId: data?.id,
    });
    return data;
  } catch (error) {
    logger.error("Error creating cognitive walkthrough issue", {
      stepId,
      issueType,
      source,
      error,
    });
    throw error;
  }
}

export async function getStudyStatus(studyId: string, userId: string) {
  logger.debug("Getting study status", { studyId, userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's study status", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
    });
    redirect("/error");
  }

  try {
    // Get study status from the db-worker
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`,
    );
    const { data: study } = await response.json();

    // If data does not exist there is a problem
    if (!study) {
      logger.error("Study not found when getting status", { studyId, userId });
      redirect("/error");
    }

    logger.info("Study status retrieved successfully", {
      studyId,
      userId,
      status: study.status,
    });
    return { status: study.status };
  } catch (error) {
    logger.error("Error fetching study status", { studyId, userId, error });
    redirect("/error");
  }
}

export async function updateUserName(userId: string, name: string) {
  logger.debug("Updating user name", { userId, name });

  const session = await isAuthenticated();

  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's name", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(`${process.env.DB_WORKER_URL}/api/user/name`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, name }),
    });

    if (!response.ok) {
      logger.error("Failed to update user name", {
        userId,
        name,
        status: response.status,
      });
      throw new Error(`Failed to update user name: ${response.status}`);
    }

    logger.info("User name updated successfully", { userId, name });
    revalidatePath("/account");
  } catch (error) {
    logger.error("Error updating user name", { userId, name, error });
    throw error;
  }
}

export async function updateUserImage(userId: string, imageKey: string | null) {
  logger.debug("Updating user image", { userId, imageKey });

  const session = await isAuthenticated();

  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's image", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/user/image`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, imageKey }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      logger.error("Failed to update user image", {
        userId,
        imageKey,
        status: response.status,
      });
      throw new Error(`Failed to update user image: ${response.status}`);
    }

    logger.info("User image updated successfully", { userId, imageKey });
    revalidatePath("/account");
  } catch (error) {
    logger.error("Error updating user image", { userId, imageKey, error });
    throw error;
  }
}

export async function initStudyDb(
  name: string | null,
  type: string,
  userId: string,
  teamId: string,
) {
  logger.debug("Initializing study via db-worker", { userId, teamId, type });
  const res = await fetchWithTimeout(
    `${process.env.DB_WORKER_URL}/api/study/init`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, teamId, name, type }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("initStudyDb failed", {
      userId,
      teamId,
      type,
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error("Failed to init study");
  }
  return (await res.json()).data; // { id, ... }
}

export async function finalizeStudyDb(
  studyId: string,
  files: Array<{ name: string; key: string; size: number; type: string }>,
  jobData: any,
) {
  const userId = jobData?.userId;
  const teamId = jobData?.teamId;
  logger.debug("Finalizing study via db-worker", {
    studyId,
    userId,
    teamId,
    fileCount: files.length,
  });

  const res = await fetchWithTimeout(
    `${process.env.DB_WORKER_URL}/api/study/finalize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyId, files, jobData }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("finalizeStudyDb failed", {
      studyId,
      userId,
      teamId,
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error(`Failed to finalize study (HTTP ${res.status})`);
  }
  return (await res.json()).data;
}

export async function getCommunicationPreferences(userId: string) {
  logger.debug("Getting communication preferences", { userId });
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's communication prefs", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/communicationPreferences?userId=${userId}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to fetch communication preferences", {
        userId,
        status: res.status,
      });
      redirect("/error");
    }
    const { data } = await res.json();
    logger.info("Communication preferences retrieved successfully", { userId });
    return data;
  } catch (error) {
    logger.error("Error fetching communication preferences", { userId, error });
    redirect("/error");
  }
}

const OPTIONAL_COMM_PREF_KEYS = [
  "digest",
  "productUpdates",
  "promotions",
  "educational",
  "feedback",
] as const;

type OptionalCommPrefKey = (typeof OPTIONAL_COMM_PREF_KEYS)[number];

export async function updateCommunicationPreferences(
  userId: string,
  updates: Partial<Record<OptionalCommPrefKey, boolean>>,
) {
  logger.debug("Updating communication preferences", {
    userId,
    keys: Object.keys(updates || {}),
  });
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's communication prefs", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }
  // Filter allowed keys
  const filtered: Record<string, boolean> = {};
  for (const k of Object.keys(updates || {})) {
    if (
      OPTIONAL_COMM_PREF_KEYS.includes(k as OptionalCommPrefKey) &&
      typeof updates[k as OptionalCommPrefKey] === "boolean"
    ) {
      filtered[k] = updates[k as OptionalCommPrefKey] as boolean;
    }
  }
  if (!Object.keys(filtered).length) {
    logger.warn("No valid communication preference fields supplied", {
      userId,
    });
    throw new Error("No valid communication preference fields supplied");
  }
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/communicationPreferences`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, updates: filtered }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to update communication preferences", {
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to update communication preferences");
    }
    const { data } = await res.json();
    logger.info("Communication preferences updated successfully", {
      userId,
      keys: Object.keys(filtered),
    });
    revalidatePath("/account");
    return data;
  } catch (error) {
    logger.error("Error updating communication preferences", { userId, error });
    throw error;
  }
}

export async function getHeuristicFamilies(companyId?: string | null) {
  const session = await isAuthenticated();
  logger.debug("Getting heuristic families", {
    companyId,
    userId: session.userId,
  });

  try {
    const url = new URL(`${process.env.DB_WORKER_URL}/api/heuristic-families`);
    if (companyId) {
      url.searchParams.set("companyId", companyId);
    }

    const response = await fetch(url.toString());
    const { data } = await response.json();

    logger.info("Heuristic families retrieved successfully", {
      familyCount: data?.length || 0,
      companyId,
      userId: session.userId,
    });

    return data;
  } catch (error) {
    logger.error("Error fetching heuristic families", {
      companyId,
      userId: session.userId,
      error,
    });
    redirect("/error");
  }
}

export async function getHeuristicFamily(familyId: string) {
  const session = await isAuthenticated();
  logger.debug("Getting heuristic family", {
    familyId,
    userId: session.userId,
  });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/heuristic-families/${familyId}`,
    );

    if (!response.ok) {
      logger.error("Failed to fetch heuristic family", {
        familyId,
        userId: session.userId,
        status: response.status,
      });
      return null;
    }

    const { data } = await response.json();

    logger.info("Heuristic family retrieved successfully", {
      familyId,
      userId: session.userId,
      heuristicCount: data?.heuristics?.length || 0,
    });

    return data;
  } catch (error) {
    logger.error("Error fetching heuristic family", {
      familyId,
      userId: session.userId,
      error,
    });
    return null;
  }
}

export async function getHeuristic(
  heuristicId: string,
  companyId?: string | null,
) {
  const session = await isAuthenticated();
  logger.debug("Getting heuristic", {
    heuristicId,
    companyId,
    userId: session.userId,
  });

  try {
    const url = new URL(
      `${process.env.DB_WORKER_URL}/api/heuristics/${heuristicId}`,
    );
    if (companyId) {
      url.searchParams.set("companyId", companyId);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      logger.error("Failed to fetch heuristic", {
        heuristicId,
        userId: session.userId,
        status: response.status,
      });
      return null;
    }

    const { data } = await response.json();

    logger.info("Heuristic retrieved successfully", {
      heuristicId,
      companyId,
      userId: session.userId,
      exampleCount: data?.examples?.length || 0,
    });

    return data;
  } catch (error) {
    logger.error("Error fetching heuristic", {
      heuristicId,
      userId: session.userId,
      error,
    });
    return null;
  }
}

export async function joinTeam(teamId: string, userId: string) {
  const session = await isAuthenticated();
  const user = await getUser(session.userId);

  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/team/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        members: [{ userId, role: "MEMBER" }],
        invitedById: userId, // Self-join, so user is adding themselves
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to join team", {
        teamId,
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to join team");
    }

    logger.info("User joined team successfully", { teamId, userId });
    revalidatePath("/team");
    return { success: true };
  } catch (error) {
    logger.error("Error joining team", { teamId, userId, error });
    throw error;
  }
}

type TeamJoinRequestMembership = {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
  team?: {
    id: string;
    name: string;
    memberships: Array<{
      userId: string;
      role: string;
      user: {
        id: string;
        name: string | null;
        email: string;
      };
    }>;
  } | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type TeamMembershipWithTeam = {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
  team?: {
    id: string;
    name: string;
  } | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

export async function requestTeamJoin(
  teamId: string,
  userId: string,
  requestNote?: string,
) {
  const session = await isAuthenticated();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/request-join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, userId, requestNote }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to request team join", {
        teamId,
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      const errorData = await res
        .json()
        .catch(() => ({ message: "Failed to request to join team" }));
      throw new Error(errorData.message || "Failed to request to join team");
    }

    const { data } = await res.json();

    const membership = data as TeamJoinRequestMembership;
    const teamName = membership?.team?.name || "your team";
    const requestorName =
      membership?.user?.name || membership?.user?.email || "A team member";
    const requestorEmail = membership?.user?.email || "";
    const teamMemberships = membership?.team?.memberships || [];
    const adminMembers = teamMemberships.filter(
      (member) => String(member.role).toUpperCase() === "ADMIN",
    );
    const ownerMembers = teamMemberships.filter(
      (member) => String(member.role).toUpperCase() === "OWNER",
    );
    const notifyMembers = adminMembers.length > 0 ? adminMembers : ownerMembers;
    const notifyEmails = Array.from(
      new Set(
        notifyMembers
          .map((member) => member.user?.email)
          .filter(
            (email): email is string =>
              Boolean(email) && email !== requestorEmail,
          ),
      ),
    );

    if (notifyEmails.length > 0) {
      try {
        const resend = new Resend(process.env.AUTH_RESEND_KEY);
        const teamSettingsUrl = `${APP_BASE_URL}/teams?teamId=${encodeURIComponent(teamId)}`;
        const subtitle = `${requestorName} requested to join ${teamName}.`;
        const contentParts = [
          `<p style="margin:0 0 16px 0;">${requestorName} (${requestorEmail}) asked to join <strong>${teamName}</strong>.</p>`,
        ];

        if (requestNote) {
          contentParts.push(
            `<p style="margin:0 0 16px 0;"><strong>Message:</strong></p>`,
            `<p style="margin:0 0 16px 0;padding:12px;background-color:#f3f4f6;border-left:3px solid #3b82f6;font-style:italic;">${requestNote}</p>`,
          );
        }

        contentParts.push(
          '<p style="margin:0;">Review the pending request from your team settings.</p>',
        );
        const content = contentParts.join("");

        await resend.emails.send({
          from: process.env.AUTH_RESEND_FROM || "support@askseer.ai",
          to: notifyEmails,
          subject: `${requestorName} requested to join ${teamName} on Seer`,
          html: createStyledEmailHtml({
            title: "New team join request",
            subtitle,
            content,
            buttonText: "Review request",
            buttonUrl: teamSettingsUrl,
            footerContact: "support@askseer.ai",
          }),
          text: `${subtitle}\n\nReview request: ${teamSettingsUrl}`,
        });
      } catch (emailError) {
        logger.error("Failed to send team join request notification", {
          teamId,
          userId,
          recipients: notifyEmails,
          error: (emailError as Error)?.message,
        });
      }
    }

    logger.info("User requested to join team successfully", { teamId, userId });
    revalidatePath("/teams");
    return { success: true };
  } catch (error) {
    logger.error("Error requesting to join team", { teamId, userId, error });
    throw error;
  }
}

export async function getTeamJoinRequests(teamId: string) {
  const session = await isAuthenticated();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/join-requests?teamId=${encodeURIComponent(teamId)}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to get team join requests", {
        teamId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to get team join requests");
    }

    const { data } = await res.json();
    return data;
  } catch (error) {
    logger.error("Error getting team join requests", { teamId, error });
    throw error;
  }
}

export async function acceptTeamJoinRequest(
  teamId: string,
  userId: string,
  acceptedById: string,
) {
  const session = await isAuthenticated();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/join-requests/accept`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, userId, acceptedById }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to accept team join request", {
        teamId,
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to accept join request");
    }

    const { data } = await res.json();
    const membership = data as TeamMembershipWithTeam | null;
    const memberEmail = membership?.user?.email;
    const teamName = membership?.team?.name || "your team";
    const teamLinkId = membership?.team?.id || membership?.teamId || teamId;
    const teamUrl = `${APP_BASE_URL}/studies?teamId=${encodeURIComponent(teamLinkId)}`;

    if (memberEmail) {
      try {
        const resend = new Resend(process.env.AUTH_RESEND_KEY);
        const subtitle = `Your request to join ${teamName} has been approved.`;
        const content = [
          `<p style="margin:0 0 16px 0;">Great news! You're now a member of <strong>${teamName}</strong>.</p>`,
          '<p style="margin:0;">Use the button below to view your new team on Seer.</p>',
        ].join("");

        await resend.emails.send({
          from: process.env.AUTH_RESEND_FROM || "support@askseer.ai",
          to: memberEmail,
          subject: `Your request to join ${teamName} was approved`,
          html: createStyledEmailHtml({
            title: "Join request approved",
            subtitle,
            content,
            buttonText: "Open team in Seer",
            buttonUrl: teamUrl,
            footerContact: "support@askseer.ai",
          }),
          text: `${subtitle}\n\nOpen your team: ${teamUrl}`,
        });
      } catch (emailError) {
        logger.error("Failed to send team join approval email", {
          teamId,
          userId,
          recipient: memberEmail,
          error: (emailError as Error)?.message,
        });
      }
    }

    logger.info("Accepted team join request successfully", {
      teamId,
      userId,
      acceptedById,
    });
    revalidatePath("/teams");
    revalidatePath("/team");
    return { success: true };
  } catch (error) {
    logger.error("Error accepting team join request", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

export async function rejectTeamJoinRequest(
  teamId: string,
  userId: string,
  rejectedById: string,
  rejectReason?: string,
) {
  const session = await isAuthenticated();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team/join-requests/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, userId, rejectedById, rejectReason }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to reject team join request", {
        teamId,
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to reject join request");
    }

    const { data } = await res.json();
    const membership = data as TeamMembershipWithTeam | null;
    const memberEmail = membership?.user?.email;
    const teamName = membership?.team?.name || "the team";
    const seerUrl = APP_BASE_URL;

    if (memberEmail) {
      try {
        const resend = new Resend(process.env.AUTH_RESEND_KEY);
        const subtitle = `Your request to join ${teamName} was not approved.`;
        const contentParts = [
          `<p style="margin:0 0 16px 0;">We wanted to let you know that your request to join <strong>${teamName}</strong> was declined.</p>`,
        ];

        if (rejectReason) {
          contentParts.push(
            `<p style="margin:0 0 16px 0;"><strong>Reason:</strong></p>`,
            `<p style="margin:0 0 16px 0;padding:12px;background-color:#f3f4f6;border-left:3px solid #ef4444;font-style:italic;">${rejectReason}</p>`,
          );
        }

        contentParts.push(
          '<p style="margin:0;">You can open Seer to explore other teams or reach out to an admin for more details.</p>',
        );
        const content = contentParts.join("");

        await resend.emails.send({
          from: process.env.AUTH_RESEND_FROM || "support@askseer.ai",
          to: memberEmail,
          subject: `Update on your request to join ${teamName}`,
          html: createStyledEmailHtml({
            title: "Join request update",
            subtitle,
            content,
            buttonText: "Open Seer",
            buttonUrl: seerUrl,
            footerContact: "support@askseer.ai",
          }),
          text: `${subtitle}\n\nOpen Seer: ${seerUrl}`,
        });
      } catch (emailError) {
        logger.error("Failed to send team join rejection email", {
          teamId,
          userId,
          recipient: memberEmail,
          error: (emailError as Error)?.message,
        });
      }
    }

    logger.info("Rejected team join request successfully", {
      teamId,
      userId,
      rejectedById,
    });
    revalidatePath("/teams");
    revalidatePath("/team");
    return { success: true };
  } catch (error) {
    logger.error("Error rejecting team join request", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

// Credit Ledger Types
export interface CreditLedgerEntry {
  id: string;
  teamId: string;
  teamName: string;
  teamIsPersonal: boolean;
  studyId: string | null;
  studyName: string | null;
  studyType: string | null;
  byUserId: string | null;
  byUserName: string | null;
  byUserEmail: string | null;
  delta: number;
  reason: string | null;
  reasonKey: string;
  createdAt: string;
}

export interface CreditLedgerResponse {
  entries: CreditLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GetCreditLedgerParams {
  userId: string;
  companyId?: string;
  isCompanyAdmin: boolean;
  teamIds: string[];
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "delta" | "teamName" | "reason" | "byUserName";
  sortOrder?: "asc" | "desc";
}

export async function getCreditLedger({
  userId,
  companyId,
  isCompanyAdmin,
  teamIds,
  page = 1,
  pageSize = 10,
  sortBy = "createdAt",
  sortOrder = "desc",
}: GetCreditLedgerParams): Promise<CreditLedgerResponse> {
  await isAuthenticated();

  try {
    const params = new URLSearchParams({
      userId,
      isCompanyAdmin: String(isCompanyAdmin),
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortOrder,
    });

    if (companyId) {
      params.set("companyId", companyId);
    }

    if (teamIds.length > 0) {
      params.set("teamIds", teamIds.join(","));
    }

    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/credit-ledger?${params.toString()}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to fetch credit ledger", {
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to fetch credit ledger");
    }

    const { data } = await res.json();
    return data as CreditLedgerResponse;
  } catch (error) {
    logger.error("Error fetching credit ledger", { userId, error });
    throw error;
  }
}

// ============================================================================
// Notification Functions
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  type: string;
  audience: "USER" | "ADMIN";
  title: string;
  message: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getNotifications(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  },
): Promise<NotificationsResponse> {
  await isAuthenticated();

  const params = new URLSearchParams({ userId });
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.unreadOnly) params.set("unreadOnly", "true");

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/notifications?${params.toString()}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to fetch notifications", {
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to fetch notifications");
    }

    const { data } = await res.json();
    return data as NotificationsResponse;
  } catch (error) {
    logger.error("Error fetching notifications", { userId, error });
    throw error;
  }
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  await isAuthenticated();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/notifications/unread-count?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      logger.error("Failed to fetch unread notification count", {
        userId,
        status: res.status,
      });
      return 0; // Return 0 instead of throwing to avoid breaking the UI
    }

    const { data } = await res.json();
    return data?.count ?? 0;
  } catch (error) {
    logger.error("Error fetching unread notification count", { userId, error });
    return 0;
  }
}

export async function createNotification(data: {
  userId: string;
  type: string;
  audience?: "USER" | "ADMIN";
  title: string;
  message?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<Notification> {
  await isAuthenticated();

  try {
    const res = await fetch(`${process.env.DB_WORKER_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to create notification", {
        data,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to create notification");
    }

    const { data: notification } = await res.json();
    return notification as Notification;
  } catch (error) {
    logger.error("Error creating notification", { data, error });
    throw error;
  }
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  await isAuthenticated();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/notifications/${notificationId}/read`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      },
    );

    if (!res.ok) {
      logger.error("Failed to mark notification as read", {
        notificationId,
        userId,
        status: res.status,
      });
      throw new Error("Failed to mark notification as read");
    }

    logger.info("Marked notification as read", { notificationId, userId });
  } catch (error) {
    logger.error("Error marking notification as read", {
      notificationId,
      userId,
      error,
    });
    throw error;
  }
}

export async function markAllNotificationsAsRead(
  userId: string,
): Promise<{ count: number }> {
  await isAuthenticated();

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/notifications/mark-all-read`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      },
    );

    if (!res.ok) {
      logger.error("Failed to mark all notifications as read", {
        userId,
        status: res.status,
      });
      throw new Error("Failed to mark all notifications as read");
    }

    const { data } = await res.json();
    logger.info("Marked all notifications as read", {
      userId,
      count: data?.count,
    });
    return data;
  } catch (error) {
    logger.error("Error marking all notifications as read", { userId, error });
    throw error;
  }
}
