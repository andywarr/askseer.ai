// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getUserTeams,
} from "@/apps/nextjs-app/lib/data";
import { PurchaseCreditsDialog } from "./purchase-credits-dialog";

const CREDIT_PRICE_FROM_ENV = Number(process.env.CREDIT_UNIT_PRICE);
const DEFAULT_CREDIT_PRICE =
  Number.isFinite(CREDIT_PRICE_FROM_ENV) && CREDIT_PRICE_FROM_ENV > 0
    ? CREDIT_PRICE_FROM_ENV
    : 19.99;

type TeamForCheckout = {
  id: string;
  name: string;
  isPersonal: boolean;
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

  if (domainInfo.company) {
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

    availableCredits = teams.reduce(
      (total, team) => total + (team?.credits ?? 0),
      0,
    );

    const myRole = String(me.role || "").toUpperCase();
    const isCompanyAdmin = myRole === "ADMIN" || myRole === "OWNER";

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
        });
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
        });
      });
  }

  const personalTeam = userTeams.find((team) => team.isPersonal);
  if (personalTeam) {
    checkoutTeamsMap.set(personalTeam.id, {
      id: personalTeam.id,
      name: `${personalTeam.name} (Personal)`,
      isPersonal: true,
    });
  }

  const checkoutTeams = Array.from(checkoutTeamsMap.values());

  creditsColorClass =
    availableCredits <= 1
      ? "text-red-500"
      : availableCredits >= 2 && availableCredits <= 9
        ? "text-amber-500"
        : "";

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Credits
      </h2>
      <div className="flex items-end justify-between gap-6">
        <div className="flex items-baseline gap-3">
          <span
            className={`text-6xl font-bold leading-none tracking-tight ${creditsColorClass}`}
          >
            {availableCredits.toLocaleString()}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            Available Credits
          </span>
        </div>
        <PurchaseCreditsDialog
          teams={checkoutTeams}
          unitPrice={DEFAULT_CREDIT_PRICE}
        />
      </div>
    </>
  );
}
