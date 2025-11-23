// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getUserTeams,
} from "@/apps/nextjs-app/lib/data";
import { Button } from "@/apps/nextjs-app/components/ui/button";

export default async function Page() {
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  let availableCredits = 0;
  let creditsColorClass = "";

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
  } else {
    let userTeams: any[] = [];
    try {
      userTeams = await getUserTeams(user.id);
    } catch {
      userTeams = [];
    }

    const personalTeam = userTeams.find((team) => team.isPersonal);
    availableCredits = personalTeam?.credits ?? 0;
  }

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
          <span className="text-base font-medium text-muted-foreground">
            Available Credits
          </span>
        </div>
        <Button>
          Add Credits
        </Button>
      </div>
    </>
  );
}
