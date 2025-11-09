import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyTeams,
} from "@/apps/nextjs-app/lib/data";
import BrowseTeams from "@/apps/nextjs-app/components/browse-teams";

export default async function Page() {
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  if (!domainInfo.company) {
    redirect("/");
  }

  if (domainInfo.company.status !== "ACTIVE") {
    redirect("/company");
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
