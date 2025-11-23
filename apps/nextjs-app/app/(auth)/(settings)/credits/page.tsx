// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getUserTeams,
} from "@/apps/nextjs-app/lib/data";

// UI component imports
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";

export default async function Page() {
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  let availableCredits = 0;
  let contextDescription = "Credits available to your personal team.";

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
    contextDescription = "Credits available across all company teams.";
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

  const creditsLabel = availableCredits === 1 ? "credit" : "credits";

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Credits
      </h2>
      <Card className="max-w-3xl">
        <CardHeader className="pb-6">
          <CardTitle>Available credits</CardTitle>
          <CardDescription>{contextDescription}</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="flex items-baseline gap-3">
            <span className="text-6xl font-bold leading-none tracking-tight">
              {availableCredits.toLocaleString()}
            </span>
            <span className="text-lg font-medium text-muted-foreground">
              {creditsLabel}
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
