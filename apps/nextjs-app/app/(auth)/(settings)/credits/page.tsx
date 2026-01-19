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
import { CreditSection } from "./credit-section";
import { CreditErrorBoundary } from "./credit-error-boundary";
import { Suspense } from "react";
import { CheckoutStatusHandler } from "./checkout-status-handler";
import {
  PERSONAL_CREDIT_PRICE,
  COMPANY_CREDIT_PRICE,
} from "@/apps/shared/constants";
import {
  type Team,
  type TeamForDisplay,
  type CompanyMembership,
  isAdminOrOwner,
  getUserTeamRole,
  mapTeamForDisplay,
} from "./types";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

// Loading skeleton for the ledger table
function CreditLedgerSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
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

async function fetchCompanyMembership(
  companyId: string,
  userId: string,
): Promise<CompanyMembership | null> {
  try {
    return await getCompanyMembership(companyId, userId);
  } catch {
    return null;
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

function processTeamsForCompanyUser(
  companyTeams: Team[],
  userTeams: Team[],
  userId: string,
  companyId: string,
  isCompanyAdmin: boolean,
): {
  checkoutTeams: TeamForDisplay[];
  transferTeams: TeamForDisplay[];
  ledgerTeamIds: string[];
  shouldRedirect: boolean;
} {
  const checkoutTeamsMap = new Map<string, TeamForDisplay>();
  const transferTeamsMap = new Map<string, TeamForDisplay>();
  const ledgerTeamIds: string[] = [];

  const isTeamAdmin = companyTeams.some(
    (team) =>
      !team.isPersonal && isAdminOrOwner(getUserTeamRole(team, userId)),
  );

  const personalTeamsDisabled = userTeams.some(
    (team) =>
      team.companyId === companyId && team.companyPersonalTeamsDisabled,
  );

  if (!isCompanyAdmin && !isTeamAdmin && personalTeamsDisabled) {
    return {
      checkoutTeams: [],
      transferTeams: [],
      ledgerTeamIds: [],
      shouldRedirect: true,
    };
  }

  for (const team of companyTeams) {
    const memberRole = getUserTeamRole(team, userId);
    const canManageTeam = isCompanyAdmin || isAdminOrOwner(memberRole);

    if (canManageTeam) {
      checkoutTeamsMap.set(team.id, mapTeamForDisplay(team));

      if (isCompanyAdmin) {
        transferTeamsMap.set(team.id, mapTeamForDisplay(team));
      } else if (!team.isPersonal) {
        transferTeamsMap.set(team.id, mapTeamForDisplay(team));
        ledgerTeamIds.push(team.id);
      }
    }
  }

  const personalTeam = userTeams.find((team) => team.isPersonal);
  if (personalTeam) {
    checkoutTeamsMap.set(personalTeam.id, mapTeamForDisplay(personalTeam));
    if (!ledgerTeamIds.includes(personalTeam.id)) {
      ledgerTeamIds.push(personalTeam.id);
    }
  }

  return {
    checkoutTeams: Array.from(checkoutTeamsMap.values()),
    transferTeams: Array.from(transferTeamsMap.values()),
    ledgerTeamIds,
    shouldRedirect: false,
  };
}

function processTeamsForNonCompanyUser(userTeams: Team[]): {
  checkoutTeams: TeamForDisplay[];
  ledgerTeamIds: string[];
} {
  const checkoutTeamsMap = new Map<string, TeamForDisplay>();
  const ledgerTeamIds: string[] = [];

  const personalTeam = userTeams.find((team) => team.isPersonal);
  if (personalTeam) {
    checkoutTeamsMap.set(personalTeam.id, mapTeamForDisplay(personalTeam));
    ledgerTeamIds.push(personalTeam.id);
  }

  for (const team of userTeams) {
    if (!team.isPersonal && isAdminOrOwner(team.role)) {
      checkoutTeamsMap.set(team.id, mapTeamForDisplay(team));
      ledgerTeamIds.push(team.id);
    }
  }

  return {
    checkoutTeams: Array.from(checkoutTeamsMap.values()),
    ledgerTeamIds,
  };
}

export default async function Page() {
  const { user } = await getCurrentUser();

  const [domainInfo, userTeams] = await Promise.all([
    getCompanyByMyDomain(),
    fetchUserTeams(user.id),
  ]);

  const hasCompany = Boolean(domainInfo.company);
  const companyId = hasCompany ? domainInfo.company!.id : undefined;

  let membership: CompanyMembership | null = null;
  let companyTeams: Team[] = [];

  if (hasCompany && companyId) {
    [membership, companyTeams] = await Promise.all([
      fetchCompanyMembership(companyId, user.id),
      fetchCompanyTeams(companyId),
    ]);
  }

  const isCompanyMember = Boolean(hasCompany && membership);
  const isCompanyAdmin = isCompanyMember && isAdminOrOwner(membership?.role);

  let checkoutTeams: TeamForDisplay[];
  let transferTeams: TeamForDisplay[] = [];
  let ledgerTeamIds: string[];

  if (isCompanyMember && companyId) {
    const result = processTeamsForCompanyUser(
      companyTeams,
      userTeams,
      user.id,
      companyId,
      isCompanyAdmin,
    );

    if (result.shouldRedirect) {
      redirect("/");
    }

    checkoutTeams = result.checkoutTeams;
    transferTeams = result.transferTeams;
    ledgerTeamIds = result.ledgerTeamIds;
  } else {
    const result = processTeamsForNonCompanyUser(userTeams);
    checkoutTeams = result.checkoutTeams;
    ledgerTeamIds = result.ledgerTeamIds;
  }

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

      <CreditErrorBoundary fallbackTitle="Purchase Error">
        <CreditSection
          title="Purchase"
          description="Choose a team, enter the number of credits, and continue to checkout."
        >
          <PurchaseCreditsForm
            teams={checkoutTeams}
            unitPrice={creditUnitPrice}
          />
        </CreditSection>
      </CreditErrorBoundary>

      {checkoutTeams.length > 0 && (
        <CreditErrorBoundary fallbackTitle="Auto-Refill Error">
          <CreditSection
            title="Auto-Refill"
            description="Automatically purchase credits when your team's balance runs low."
            className="mt-6"
          >
            <AutoRefillForm teams={checkoutTeams} unitPrice={creditUnitPrice} />
          </CreditSection>
        </CreditErrorBoundary>
      )}

      {showTransferSection && (
        <CreditErrorBoundary fallbackTitle="Transfer Error">
          <CreditSection
            title="Transfer"
            description="Move credits between teams you manage."
            className="mt-6"
          >
            <TransferCreditsForm teams={transferTeams} />
          </CreditSection>
        </CreditErrorBoundary>
      )}

      <CreditErrorBoundary fallbackTitle="Activity Error">
        <CreditSection
          title="Activity"
          description={
            isCompanyAdmin
              ? "View all credit activity for your company."
              : "View credit activity for teams you manage."
          }
          className="mt-6"
        >
          <Suspense fallback={<CreditLedgerSkeleton />}>
            <CreditLedgerTable
              userId={user.id}
              companyId={companyId}
              isCompanyAdmin={isCompanyAdmin}
              teamIds={ledgerTeamIds}
              initialData={initialLedgerData}
            />
          </Suspense>
        </CreditSection>
      </CreditErrorBoundary>
    </>
  );
}
