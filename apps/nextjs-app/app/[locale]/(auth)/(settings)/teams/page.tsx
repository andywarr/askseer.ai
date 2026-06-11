// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
} from "@/apps/nextjs-app/lib/db/data";

// Component imports
import CompanyTeams from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/teams/company-teams";

// Types
import type { CompanyMember, Team, TeamMember } from "./types";

export default async function Page() {
  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  if (!domainInfo.company) {
    redirect("/");
  }

  if (domainInfo.company.status !== "ACTIVE") {
    redirect("/company");
  }

  // Parallelize data fetches for better performance
  let members: CompanyMember[] = [];
  let teams: Team[] = [];

  try {
    [members, teams] = await Promise.all([
      getCompanyMembers(domainInfo.company.id),
      getCompanyTeams(domainInfo.company.id),
    ]);
  } catch {
    redirect("/");
  }

  const me = members.find((m) => m.userId === user.id);
  // If user is not in the members list or is deactivated, redirect
  if (!me || me.status === "DEACTIVATED") {
    redirect("/");
  }

  const role = String(me.role || "").toUpperCase();
  const isOwner = role === "OWNER";
  const isAdmin = role === "ADMIN";
  const canManageAllTeams = isOwner || isAdmin;

  const administeredTeams = teams.filter(
    (team) =>
      !team.isPersonal &&
      (team.members || []).some(
        (member: TeamMember) =>
          member.userId === user.id &&
          String(member.role || "").toUpperCase() === "ADMIN",
      ),
  );

  const visibleTeams = canManageAllTeams ? teams : administeredTeams;

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
        members={members}
        disablePersonalTeams={domainInfo.company.disablePersonalTeams ?? true}
      />
    </>
  );
}
