// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
} from "@/apps/nextjs-app/lib/data";

// Component imports
import CompanyTeams from "@/apps/nextjs-app/app/(auth)/(settings)/teams/company-teams";

export default async function Page() {
  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  if (!domainInfo.company) {
    redirect("/");
  }

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

  const role = String(me.role || "").toUpperCase();
  const isOwner = role === "OWNER";
  const isAdmin = role === "ADMIN";

  if (domainInfo.company.status !== "ACTIVE") {
    redirect("/company");
  }

  let teams: any[] = [];
  try {
    teams = await getCompanyTeams(domainInfo.company.id);
  } catch {
    teams = [];
  }

  const administeredTeams = teams.filter(
    (team: any) =>
      !team.isPersonal &&
      (team.members || []).some(
        (member: any) =>
          member.userId === user.id &&
          String(member.role || "").toUpperCase() === "ADMIN",
      ),
  );

  const canManageAllTeams = isOwner || isAdmin;
  const visibleTeams = canManageAllTeams ? teams : administeredTeams;

  const membersForClient = members;

  if (!canManageAllTeams && administeredTeams.length === 0) {
    redirect("/");
  }

  return (
    <>
      <CompanyTeams
        companyId={domainInfo.company.id}
        teams={visibleTeams}
        canEdit={canManageAllTeams}
        currentUserId={user.id}
        members={membersForClient}
        disablePersonalTeams={domainInfo.company.disablePersonalTeams ?? true}
      />
    </>
  );
}
