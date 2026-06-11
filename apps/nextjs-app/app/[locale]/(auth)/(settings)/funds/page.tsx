import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembership,
  getCompanyTeams,
  getUserTeams,
  getBalanceLedger,
  type BalanceLedgerResponse,
} from "@/apps/nextjs-app/lib/db/data";
import { PurchaseFundsForm } from "./purchase-funds-form";
import { TransferFundsForm } from "./transfer-funds-form";
import { AutoRefillForm } from "./auto-refill-form";
import { BalanceLedgerTable } from "./balance-ledger-table";
import { BalanceSection } from "./balance-section";
import { BalanceErrorBoundary } from "./balance-error-boundary";
import { Suspense } from "react";
import { CheckoutStatusHandler } from "./checkout-status-handler";
import {
  type Team,
  type TeamForDisplay,
  type CompanyMembership,
  isAdminOrOwner,
  getUserTeamRole,
  mapTeamForDisplay,
} from "./types";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import { getTranslations } from "next-intl/server";

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
}): Promise<BalanceLedgerResponse> {
  try {
    return await getBalanceLedger({
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
  t: any,
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
    (team) => !team.isPersonal && isAdminOrOwner(getUserTeamRole(team, userId)),
  );

  const personalTeamsDisabled = userTeams.some(
    (team) => team.companyId === companyId && team.companyPersonalTeamsDisabled,
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
      // Inject companyId since getCompanyTeams doesn't return it
      const teamWithCompany = { ...team, companyId };
      checkoutTeamsMap.set(team.id, mapTeamForDisplay(teamWithCompany, t));

      if (isCompanyAdmin) {
        transferTeamsMap.set(team.id, mapTeamForDisplay(teamWithCompany, t));
      } else if (!team.isPersonal) {
        transferTeamsMap.set(team.id, mapTeamForDisplay(teamWithCompany, t));
        ledgerTeamIds.push(team.id);
      }
    }
  }

  const personalTeam = userTeams.find((team) => team.isPersonal);
  if (personalTeam) {
    checkoutTeamsMap.set(personalTeam.id, mapTeamForDisplay(personalTeam, t));
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

function processTeamsForNonCompanyUser(userTeams: Team[], t: any): {
  checkoutTeams: TeamForDisplay[];
  ledgerTeamIds: string[];
} {
  const checkoutTeamsMap = new Map<string, TeamForDisplay>();
  const ledgerTeamIds: string[] = [];

  const personalTeam = userTeams.find((team) => team.isPersonal);
  if (personalTeam) {
    checkoutTeamsMap.set(personalTeam.id, mapTeamForDisplay(personalTeam, t));
    ledgerTeamIds.push(personalTeam.id);
  }

  for (const team of userTeams) {
    if (!team.isPersonal && isAdminOrOwner(team.role)) {
      checkoutTeamsMap.set(team.id, mapTeamForDisplay(team, t));
      ledgerTeamIds.push(team.id);
    }
  }

  return {
    checkoutTeams: Array.from(checkoutTeamsMap.values()),
    ledgerTeamIds,
  };
}

export default async function Page() {
  const t = await getTranslations("FundsSettings");
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
      t,
    );

    if (result.shouldRedirect) {
      redirect("/");
    }

    checkoutTeams = result.checkoutTeams;
    transferTeams = result.transferTeams;
    ledgerTeamIds = result.ledgerTeamIds;
  } else {
    const result = processTeamsForNonCompanyUser(userTeams, t);
    checkoutTeams = result.checkoutTeams;
    ledgerTeamIds = result.ledgerTeamIds;
  }

  const showTransferSection = isCompanyMember && transferTeams.length >= 2;

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
        {t("tabs.funds")}
      </h2>

      <BalanceErrorBoundary fallbackTitle={t("errors.purchaseError")}>
        <BalanceSection
          title={t("sections.purchaseTitle")}
          description={t("sections.purchaseDescription")}
        >
          <PurchaseFundsForm teams={checkoutTeams} />
        </BalanceSection>
      </BalanceErrorBoundary>

      {checkoutTeams.length > 0 && (
        <BalanceErrorBoundary fallbackTitle={t("errors.autoRefillError")}>
          <BalanceSection
            title={t("sections.autoRefillTitle")}
            description={t("sections.autoRefillDescription")}
            className="mt-6"
          >
            <AutoRefillForm teams={checkoutTeams} />
          </BalanceSection>
        </BalanceErrorBoundary>
      )}

      {showTransferSection && (
        <BalanceErrorBoundary fallbackTitle={t("errors.transferError")}>
          <BalanceSection
            title={t("sections.transferTitle")}
            description={t("sections.transferDescription")}
            className="mt-6"
          >
            <TransferFundsForm teams={transferTeams} />
          </BalanceSection>
        </BalanceErrorBoundary>
      )}

      <BalanceErrorBoundary fallbackTitle={t("errors.activityError")}>
        <BalanceSection
          title={t("sections.activityTitle")}
          description={
            isCompanyAdmin
              ? t("sections.activityDescriptionAdmin")
              : t("sections.activityDescriptionManage")
          }
          className="mt-6"
        >
          <Suspense fallback={<CreditLedgerSkeleton />}>
            <BalanceLedgerTable
              userId={user.id}
              companyId={companyId}
              isCompanyAdmin={isCompanyAdmin}
              teamIds={ledgerTeamIds}
              initialData={initialLedgerData}
            />
          </Suspense>
        </BalanceSection>
      </BalanceErrorBoundary>
    </>
  );
}
