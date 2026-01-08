import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
} from "@/apps/nextjs-app/lib/db/data";
import BrowseTeams from "@/apps/nextjs-app/app/(auth)/team/browse-teams";

export default async function Page() {
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  if (!domainInfo.company) {
    redirect("/");
  }

  if (domainInfo.company.status !== "ACTIVE") {
    redirect("/company");
  }

  // Check if user is deactivated in the company
  let members: any[] = [];
  try {
    members = await getCompanyMembers(domainInfo.company.id);
  } catch {
    redirect("/");
  }

  const me = members.find((m: any) => m.userId === user.id);
  // If user is not in the members list or is deactivated, redirect
  if (!me || me.status === "DEACTIVATED") {
    redirect("/");
  }

  let teams: any[] = [];
  try {
    teams = await getCompanyTeams(domainInfo.company.id);
  } catch {
    teams = [];
  }

  // Filter out personal teams for browsing and hide secret teams unless member
  const browseableTeams = teams.filter(
    (team: any) =>
      !team.isPersonal &&
      (team.joinPolicy !== "SECRET" ||
        (team.members || []).some(
          (member: any) =>
            member.userId === user.id && member.status === "ACTIVE",
        )),
  );

  return (
    <BrowseTeams
      teams={browseableTeams}
      currentUserId={user.id}
      companyId={domainInfo.company.id}
    />
  );
}
