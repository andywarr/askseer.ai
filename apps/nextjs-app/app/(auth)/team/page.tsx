import type { Metadata } from "next";
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
} from "@/apps/nextjs-app/lib/db/data";
import BrowseTeams from "@/apps/nextjs-app/app/(auth)/team/browse-teams";

export const metadata: Metadata = {
  title: "Teams",
};

export default async function Page() {
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  if (!domainInfo.company) {
    redirect("/");
  }

  if (domainInfo.company.status !== "ACTIVE") {
    redirect("/company");
  }

  // Fetch members and teams in parallel — they're independent queries
  const [members, teams] = await Promise.all([
    getCompanyMembers(domainInfo.company.id).catch(() => null),
    getCompanyTeams(domainInfo.company.id).catch(
      () => [] as Awaited<ReturnType<typeof getCompanyTeams>>,
    ),
  ]);

  if (!members) {
    redirect("/");
  }

  const me = members.find((m) => m.userId === user.id);
  // If user is not in the members list or is deactivated, redirect
  if (!me || me.status === "DEACTIVATED") {
    redirect("/");
  }

  // Filter out personal teams for browsing and hide secret teams unless member
  const browseableTeams = teams.filter(
    (team) =>
      !team.isPersonal &&
      (team.joinPolicy !== "SECRET" ||
        team.members.some((member) => member.userId === user.id)),
  );

  return <BrowseTeams teams={browseableTeams} currentUserId={user.id} />;
}
