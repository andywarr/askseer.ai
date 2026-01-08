// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembership,
  getCompanyTeams,
  getUserTeams,
  getCreditLedger,
  type CreditLedgerResponse,
} from "@/apps/nextjs-app/lib/db/data";
import { PurchaseCreditsForm } from "./purchase-credits-form";
import { TransferCreditsForm } from "./transfer-credits-form";
import { AutoRefillForm } from "./auto-refill-form";
import { CreditLedgerTable } from "./credit-ledger-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Suspense } from "react";
import { CheckoutStatusHandler } from "./checkout-status-handler";
import {
  PERSONAL_CREDIT_PRICE,
  COMPANY_CREDIT_PRICE,
} from "@/apps/shared/constants";

// Types
interface TeamMember {
  userId: string;
  role: string;
}

interface Team {
  id: string;
  name: string;
  isPersonal: boolean;
  credits: number;
  companyId?: string | null;
  companyPersonalTeamsDisabled?: boolean;
  members?: TeamMember[];
  role?: string; // User's role in the team (from getUserTeams)
}

interface CompanyMembership {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
}

interface TeamForCheckout {
  id: string;
  name: string;
  isPersonal: boolean;
  credits: number;
}

type TeamForTransfer = TeamForCheckout;

// Helper functions
function isAdminOrOwner(role: string | undefined | null): boolean {
  const normalizedRole = String(role || "").toUpperCase();
  return normalizedRole === "ADMIN" || normalizedRole === "OWNER";
}

function getUserTeamRole(team: Team, userId: string): string {
  const member = team.members?.find((m) => m.userId === userId);
  return String(member?.role || "").toUpperCase();
}

function mapTeamForDisplay(team: Team): TeamForCheckout {
  return {
    id: team.id,
    name: team.isPersonal ? `${team.name} (Personal)` : team.name,
    isPersonal: Boolean(team.isPersonal),
    credits: team.credits ?? 0,
  };
}

async function fetchUserTeams(userId: string): Promise<Team[]> {
  try {
    return await getUserTeams(userId);
  } catch {
    return [];
  }
}

async function fetchCompanyTeams(companyId: string): Promise<Team[]> {
  try {
    return await getCompanyTeams(companyId);
  } catch {
    return [];
  }
}

async function fetchLedgerData(params: {
  userId: string;
  companyId?: string;
  isCompanyAdmin: boolean;
  teamIds: string[];
}): Promise<CreditLedgerResponse> {
  try {
    return await getCreditLedger({
      ...params,
      page: 1,
      pageSize: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  } catch {
    return {
      entries: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };
  }
}

export default async function Page() {
  const { user } = await getCurrentUser();

  // Fetch domain info and user teams in parallel
  const [domainInfo, userTeams] = await Promise.all([
    getCompanyByMyDomain(),
    fetchUserTeams(user.id),
  ]);

  // Check company membership if domain has a company
  const membership: CompanyMembership | null = domainInfo.company
    ? await getCompanyMembership(domainInfo.company.id, user.id)
    : null;

  const isCompanyMember = Boolean(domainInfo.company && membership);
  const companyId = isCompanyMember ? domainInfo.company!.id : undefined;
  const isCompanyAdmin = isCompanyMember && isAdminOrOwner(membership?.role);

  const checkoutTeamsMap = new Map<string, TeamForCheckout>();
  const transferTeamsMap = new Map<string, TeamForTransfer>();
  const ledgerTeamIds: string[] = [];

  if (isCompanyMember && companyId) {
    const teams = await fetchCompanyTeams(companyId);

    // Check if user is a team admin/owner
    const isTeamAdmin = teams.some(
      (team) =>
        !team.isPersonal && isAdminOrOwner(getUserTeamRole(team, user.id)),
    );

    // Access control: Redirect if user lacks permission
    const personalTeamsDisabled = userTeams.some(
      (team) =>
        team.companyId === companyId && team.companyPersonalTeamsDisabled,
    );

    if (!isCompanyAdmin && !isTeamAdmin && personalTeamsDisabled) {
      redirect("/");
    }

    // Process company teams
    for (const team of teams) {
      const memberRole = getUserTeamRole(team, user.id);
      const canManageTeam = isCompanyAdmin || isAdminOrOwner(memberRole);

      if (canManageTeam) {
        checkoutTeamsMap.set(team.id, mapTeamForDisplay(team));

        // Transfer teams: company admins can transfer any team
        // Team admins can only transfer non-personal teams they admin
        if (isCompanyAdmin) {
          transferTeamsMap.set(team.id, mapTeamForDisplay(team));
        } else if (!team.isPersonal) {
          transferTeamsMap.set(team.id, mapTeamForDisplay(team));
          ledgerTeamIds.push(team.id);
        }
      }
    }
  } else {
    // Non-company user: add teams they admin
    const personalTeam = userTeams.find((team) => team.isPersonal);
    if (personalTeam) {
      ledgerTeamIds.push(personalTeam.id);
    }

    for (const team of userTeams) {
      if (!team.isPersonal && isAdminOrOwner(team.role)) {
        checkoutTeamsMap.set(team.id, mapTeamForDisplay(team));
        ledgerTeamIds.push(team.id);
      }
    }
  }

  // Always add personal team for checkout and ledger
  const personalTeam = userTeams.find((team) => team.isPersonal);
  if (personalTeam) {
    checkoutTeamsMap.set(personalTeam.id, mapTeamForDisplay(personalTeam));
    if (!ledgerTeamIds.includes(personalTeam.id)) {
      ledgerTeamIds.push(personalTeam.id);
    }
  }

  const checkoutTeams = Array.from(checkoutTeamsMap.values());
  const transferTeams = Array.from(transferTeamsMap.values());
  const showTransferSection = isCompanyMember && transferTeams.length >= 2;
  const creditUnitPrice = isCompanyMember
    ? COMPANY_CREDIT_PRICE
    : PERSONAL_CREDIT_PRICE;

  const initialLedgerData = await fetchLedgerData({
    userId: user.id,
    companyId,
    isCompanyAdmin,
    teamIds: ledgerTeamIds,
  });

  return (
    <>
      <Suspense fallback={null}>
        <CheckoutStatusHandler />
      </Suspense>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Credits
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>Purchase</CardTitle>
          <CardDescription>
            Choose a team, enter the number of credits, and continue to
            checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PurchaseCreditsForm
            teams={checkoutTeams}
            unitPrice={creditUnitPrice}
          />
        </CardContent>
      </Card>
      {checkoutTeams.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Auto-Refill</CardTitle>
            <CardDescription>
              Automatically purchase credits when your team&apos;s balance runs
              low.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AutoRefillForm teams={checkoutTeams} unitPrice={creditUnitPrice} />
          </CardContent>
        </Card>
      )}
      {showTransferSection && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Transfer</CardTitle>
            <CardDescription>
              Move credits between teams you manage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransferCreditsForm teams={transferTeams} />
          </CardContent>
        </Card>
      )}
      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            {isCompanyAdmin
              ? "View all credit activity for your company."
              : "View credit activity for teams you manage."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <CreditLedgerTable
            userId={user.id}
            companyId={companyId}
            isCompanyAdmin={isCompanyAdmin}
            teamIds={ledgerTeamIds}
            initialData={initialLedgerData}
          />
        </CardContent>
      </Card>
    </>
  );
}
