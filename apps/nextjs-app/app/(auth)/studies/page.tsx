// Next imports
import { redirect } from "next/navigation";

// Lib functions imports
import {
  getCurrentUser,
  canUserPurchaseCredits,
} from "@/apps/nextjs-app/lib/user";
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import {
  getStudies,
  getUserTeams,
  isUserTeamAdmin,
  getTeam,
  getCompanyByMyDomain,
  getStarredStudyIds,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";

// Custom component imports
import { StudiesView } from "@/apps/nextjs-app/app/(auth)/studies/studies-view";
import { TeamSwitcher } from "@/apps/nextjs-app/components/layout/team-switcher";
import { NoCreditsAlert } from "@/apps/nextjs-app/components/credits/no-credits-alert";
import { ClaimCompanyAlert } from "@/apps/nextjs-app/app/(auth)/studies/claim-company-alert";
import { EmptyState } from "@/apps/nextjs-app/app/(auth)/studies/empty-state";

// Force dynamic rendering to ensure fresh data on team switching
export const dynamic = "force-dynamic";

export default async function Page() {
  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  const [
    studies,
    userTeams,
    team,
    canPurchaseCredits,
    domainInfo,
    starredStudyIds,
  ] = await Promise.all([
    getStudies(user.id, {
      teamId: user.selectedTeamId ?? undefined,
    }),
    getUserTeams(user.id),
    user.selectedTeamId ? getTeam(user.selectedTeamId) : null,
    canUserPurchaseCredits(user.id),
    getCompanyByMyDomain(),
    getStarredStudyIds(user.id),
  ]);

  // Determine if user can claim a company
  const canClaimCompany =
    domainInfo.isConsumer === false &&
    !domainInfo.company &&
    !!domainInfo.domain;

  // Determine if user is a company user and if they've joined any company teams
  const isCompanyUser = !!domainInfo.company;
  // A user has joined company teams if they have any non-personal teams
  const hasJoinedCompanyTeams = userTeams.some(
    (team: { isPersonal: boolean }) => !team.isPersonal
  );

  logger.info("Studies page rendered successfully", {
    userId: user.id,
    studyCount: studies.length,
  });

  const teamAdminMap = new Map<string, boolean>();
  const teamIds = Array.from(
    new Set(
      studies
        .map((study: any) => study.teamId)
        .filter((teamId: string | null | undefined) => !!teamId) as string[],
    ),
  );

  await Promise.all(
    teamIds.map(async (teamId) => {
      try {
        const isAdmin = await isUserTeamAdmin(user.id, teamId);
        teamAdminMap.set(teamId, isAdmin);
      } catch (error) {
        logger.warn("Failed to determine team admin status", {
          userId: user.id,
          teamId,
          error,
        });
        teamAdminMap.set(teamId, false);
      }
    }),
  );

  return (
    <TeamSwitcher currentTeamId={user.selectedTeamId} userTeams={userTeams}>
      <div>
        <NoCreditsAlert
          credits={team?.credits ?? 0}
          canPurchaseCredits={canPurchaseCredits}
          teamId={user.selectedTeamId}
        />
        <ClaimCompanyAlert canClaimCompany={canClaimCompany} />
        {studies.length === 0 ? (
          <EmptyState
            isCompanyUser={isCompanyUser}
            hasJoinedCompanyTeams={hasJoinedCompanyTeams}
            companyName={domainInfo.company?.name}
          />
        ) : (
          <StudiesView
            studies={await Promise.all(
              studies.map(async (study: any) => {
                const previewUrl =
                  study.files && study.files.length > 0
                    ? await getPresignedUrls(study.files[0].key)
                    : null;
                const isOwner = study.createdByUserId === user.id;
                const canManageStudy =
                  isOwner ||
                  (study.teamId
                    ? teamAdminMap.get(study.teamId) === true
                    : false);

                return {
                  study,
                  previewUrl,
                  canManage: canManageStudy,
                };
              }),
            )}
            currentUserId={user.id}
            teamMembers={
              team?.memberships?.map((m: any) => ({
                id: m.userId,
                name: m.user?.name ?? null,
                email: m.user?.email ?? null,
                image: m.user?.image ?? null,
              })) ?? []
            }
            starredStudyIds={starredStudyIds}
          />
        )}
      </div>
    </TeamSwitcher>
  );
}
