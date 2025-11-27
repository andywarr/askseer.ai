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
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";

// Custom component imports
import { StudyCard } from "@/apps/nextjs-app/components/study-card";
import { TeamSwitcher } from "@/apps/nextjs-app/components/team-switcher";
import { NoCreditsAlert } from "@/apps/nextjs-app/components/no-credits-alert";
import { ClaimCompanyAlert } from "@/apps/nextjs-app/components/claim-company-alert";

// Force dynamic rendering to ensure fresh data on team switching
export const dynamic = "force-dynamic";

export default async function Page() {
  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  const [studies, userTeams, team, canPurchaseCredits, domainInfo] =
    await Promise.all([
      getStudies(user.id, {
        teamId: user.selectedTeamId ?? undefined,
      }),
      getUserTeams(user.id),
      user.selectedTeamId ? getTeam(user.selectedTeamId) : null,
      canUserPurchaseCredits(user.id),
      getCompanyByMyDomain(),
    ]);

  // Determine if user can claim a company
  const canClaimCompany =
    domainInfo.isConsumer === false &&
    !domainInfo.company &&
    !!domainInfo.domain;

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
        <div className="mb-6 flex">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
            {user.name ? `Welcome, ${user.name.split(" ")[0]}!` : `Welcome!`}
          </h1>
        </div>
        <NoCreditsAlert
          credits={team?.credits ?? 0}
          canPurchaseCredits={canPurchaseCredits}
          teamId={user.selectedTeamId}
        />
        <ClaimCompanyAlert canClaimCompany={canClaimCompany} />
        {studies.length === 0 ? (
          <div className="flex justify-center">
            <div className="mb-2 text-center italic">No studies!</div>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
            }}
          >
            {await Promise.all(
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

                return (
                  <StudyCard
                    key={study.id}
                    study={study}
                    currentUserId={user.id}
                    previewUrl={previewUrl}
                    canManage={canManageStudy}
                    imagePriority
                  />
                );
              }),
            )}
          </div>
        )}
      </div>
    </TeamSwitcher>
  );
}
