// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getUserTeams,
} from "@/apps/nextjs-app/lib/data";
import { PurchaseCreditsForm } from "./purchase-credits-form";
import { TransferCreditsForm } from "./transfer-credits-form";
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

type TeamForCheckout = {
  id: string;
  name: string;
  isPersonal: boolean;
  credits: number;
};

type TeamForTransfer = {
  id: string;
  name: string;
  isPersonal: boolean;
  credits: number;
};

export default async function Page() {
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  let userTeams: any[] = [];
  try {
    userTeams = await getUserTeams(user.id);
  } catch {
    userTeams = [];
  }

  let availableCredits = 0;
  let creditsColorClass = "";
  const checkoutTeamsMap = new Map<string, TeamForCheckout>();
  const transferTeamsMap = new Map<string, TeamForTransfer>();
  let isCompanyMember = false;

  if (domainInfo.company) {
    isCompanyMember = true;
    let members: any[] = [];
    try {
      members = await getCompanyMembers(domainInfo.company.id);
    } catch {
      redirect("/");
    }

    const me = members.find((member) => member.userId === user.id);
    if (!me || me.status === "DEACTIVATED") {
      redirect("/");
    }

    let teams: any[] = [];
    try {
      teams = await getCompanyTeams(domainInfo.company.id);
    } catch {
      teams = [];
    }

    const myRole = String(me.role || "").toUpperCase();
    const isCompanyAdmin = myRole === "ADMIN" || myRole === "OWNER";

    // Check if user is a team admin/owner
    const isTeamAdmin = teams.some(
      (team: any) =>
        !team.isPersonal &&
        (team.members || []).some(
          (member: any) =>
            member.userId === user.id &&
            String(member.role || "").toUpperCase() === "ADMIN",
        ),
    );

    // Access control: Check if user should have access to credits page
    // Redirect if:
    // - User is part of a company AND
    // - User is not a company admin/owner AND
    // - User is not a team admin/owner AND
    // - Personal teams are disabled for the company
    const personalTeamsDisabled = userTeams.some(
      (team) =>
        team.companyId === domainInfo.company?.id &&
        team.companyPersonalTeamsDisabled,
    );

    // Redirect if user doesn't have permission
    if (!isCompanyAdmin && !isTeamAdmin && personalTeamsDisabled) {
      redirect("/");
    }

    availableCredits = teams.reduce(
      (total, team) => total + (team?.credits ?? 0),
      0,
    );

    teams.forEach((team) => {
      const membershipRole = String(
        team?.members?.find((m: any) => m.userId === user.id)?.role || "",
      ).toUpperCase();
      if (
        isCompanyAdmin ||
        membershipRole === "ADMIN" ||
        membershipRole === "OWNER"
      ) {
        checkoutTeamsMap.set(team.id, {
          id: team.id,
          name: team.isPersonal ? `${team.name} (Personal)` : team.name,
          isPersonal: Boolean(team.isPersonal),
          credits: team.credits ?? 0,
        });

        // Transfer teams: company admins can transfer any team (including personal)
        // Team admins can only transfer non-personal teams they admin
        if (isCompanyAdmin) {
          transferTeamsMap.set(team.id, {
            id: team.id,
            name: team.isPersonal ? `${team.name} (Personal)` : team.name,
            isPersonal: Boolean(team.isPersonal),
            credits: team.credits ?? 0,
          });
        } else if (
          !team.isPersonal &&
          (membershipRole === "ADMIN" || membershipRole === "OWNER")
        ) {
          transferTeamsMap.set(team.id, {
            id: team.id,
            name: team.name,
            isPersonal: false,
            credits: team.credits ?? 0,
          });
        }
      }
    });
  } else {
    const personalTeam = userTeams.find((team) => team.isPersonal);
    availableCredits = personalTeam?.credits ?? 0;

    userTeams
      .filter((team) => {
        const role = String(team.role || "").toUpperCase();
        return !team.isPersonal && (role === "ADMIN" || role === "OWNER");
      })
      .forEach((team) => {
        checkoutTeamsMap.set(team.id, {
          id: team.id,
          name: team.name,
          isPersonal: Boolean(team.isPersonal),
          credits: team.credits ?? 0,
        });
      });
  }

  const personalTeam = userTeams.find((team) => team.isPersonal);
  if (personalTeam) {
    checkoutTeamsMap.set(personalTeam.id, {
      id: personalTeam.id,
      name: `${personalTeam.name} (Personal)`,
      isPersonal: true,
      credits: personalTeam.credits ?? 0,
    });
  }

  const checkoutTeams = Array.from(checkoutTeamsMap.values());
  const transferTeams = Array.from(transferTeamsMap.values());

  // Show transfer section only for company members with 2+ eligible teams
  const showTransferSection = isCompanyMember && transferTeams.length >= 2;

  // Determine credit price based on company membership
  const creditUnitPrice = isCompanyMember
    ? COMPANY_CREDIT_PRICE
    : PERSONAL_CREDIT_PRICE;

  creditsColorClass =
    availableCredits <= 1
      ? "text-red-500"
      : availableCredits >= 2 && availableCredits <= 9
        ? "text-amber-500"
        : "";

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
          <CardTitle>Purchase Credits</CardTitle>
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
      {showTransferSection && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Transfer Credits</CardTitle>
            <CardDescription>
              Move credits between teams you manage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransferCreditsForm teams={transferTeams} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
