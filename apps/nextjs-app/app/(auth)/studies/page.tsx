// Lib functions imports
import {
  getCurrentUser,
  canUserPurchaseCredits,
} from "@/apps/nextjs-app/lib/db/user";
import { getPresignedUrls } from "@/apps/nextjs-app/lib/actions/s3-actions";
import {
  getStudies,
  getUserTeams,
  isUserTeamAdmin,
  getTeam,
  getCompanyByMyDomain,
  getBookmarkedStudyIds,
  getUserCompanyRole,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import {
  PERSONAL_MIN_STUDY_COST_CENTS,
  COMPANY_MIN_STUDY_COST_CENTS,
} from "@/apps/shared/constants";

// Custom component imports
import { StudiesView } from "@/apps/nextjs-app/app/(auth)/studies/studies-view";
import { TeamSwitcher } from "@/apps/nextjs-app/components/layout/team-switcher";
import { NoFundsAlert } from "@/apps/nextjs-app/components/funds/no-funds-alert";
import { ClaimCompanyAlert } from "@/apps/nextjs-app/app/(auth)/studies/claim-company-alert";
import { EmptyState } from "@/apps/nextjs-app/app/(auth)/studies/empty-state";

// Force dynamic rendering to ensure fresh data on team switching
export const dynamic = "force-dynamic";

export default async function Page() {
  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  // Kick off all independent fetches in parallel — no sequential awaits
  const [
    studies,
    userTeams,
    team,
    canPurchaseCredits,
    domainInfo,
    bookmarkedStudyIds,
  ] = await Promise.all([
    getStudies(user.id, {
      teamId: user.selectedTeamId ?? undefined,
    }),
    getUserTeams(user.id),
    user.selectedTeamId ? getTeam(user.selectedTeamId) : null,
    canUserPurchaseCredits(user.id),
    getCompanyByMyDomain(),
    getBookmarkedStudyIds(user.id),
  ]);

  // Determine if user can claim a company
  const canClaimCompany =
    domainInfo.isConsumer === false &&
    !domainInfo.company &&
    !!domainInfo.domain;

  const studyCostCents = team?.companyId
    ? COMPANY_MIN_STUDY_COST_CENTS
    : PERSONAL_MIN_STUDY_COST_CENTS;

  // Parallel: fetch company role + team admin statuses at the same time
  const teamIds = Array.from(
    new Set(
      studies
        .map((study: any) => study.teamId)
        .filter((teamId: string | null | undefined) => !!teamId) as string[],
    ),
  );

  const [membershipRole, teamAdminEntries] = await Promise.all([
    domainInfo.company?.id
      ? getUserCompanyRole(user.id, domainInfo.company.id)
      : null,
    Promise.all(
      teamIds.map(async (teamId) => {
        try {
          const isAdmin = await isUserTeamAdmin(user.id, teamId);
          return [teamId, isAdmin] as const;
        } catch (error) {
          logger.warn("Failed to determine team admin status", {
            userId: user.id,
            teamId,
            error,
          });
          return [teamId, false] as const;
        }
      }),
    ),
  ]);

  const teamAdminMap = new Map<string, boolean>(teamAdminEntries);

  // Determine if user is a company user (enrolled, not just has company on domain)
  const isCompanyUser = !!domainInfo.company && !!membershipRole;
  // A user has joined company teams if they have any non-personal teams
  const hasJoinedCompanyTeams = userTeams.some(
    (team: { isPersonal: boolean }) => !team.isPersonal,
  );

  logger.info("Studies page rendered successfully", {
    userId: user.id,
    studyCount: studies.length,
  });

  // Build study data with presigned URLs in parallel
  const studiesWithPreviews = await Promise.all(
    studies.map(async (study: any) => {
      let previewUrl = null;
      if (study.files && study.files.length > 0) {
        // Only use image files for preview — skip PDFs, audio, video, etc.
        const imageFile = study.files.find((f: any) => f.fileType === "IMAGE");
        const previewFile = imageFile || null;
        if (previewFile) {
          try {
            const result = await getPresignedUrls(previewFile.key);
            previewUrl = result.success && result.data ? result.data : null;
          } catch (error) {
            logger.warn("Failed to get presigned URL for study preview", {
              studyId: study.id,
              fileKey: previewFile.key,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
      // Fallback: use qualitative analysis cover image for QUAL_ANALYSIS studies
      if (!previewUrl && study.qualitativeAnalysis?.coverImageKey) {
        try {
          const result = await getPresignedUrls(
            study.qualitativeAnalysis.coverImageKey,
          );
          previewUrl = result.success && result.data ? result.data : null;
        } catch (error) {
          logger.warn("Failed to get presigned URL for cover image", {
            studyId: study.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const isOwner = study.createdByUserId === user.id;
      const canManageStudy =
        isOwner ||
        (study.teamId ? teamAdminMap.get(study.teamId) === true : false);

      // Check if this persona study has associated heuristic evaluations or cognitive walkthroughs
      const hasAssociatedStudies =
        study.type === "PERSONA" &&
        !!study.persona &&
        ((study.persona._count?.heuristicEvaluations ?? 0) > 0 ||
          (study.persona._count?.cognitiveWalkthroughs ?? 0) > 0);

      return {
        study,
        previewUrl,
        canManage: canManageStudy,
        hasAssociatedStudies,
      };
    }),
  );

  const teamMembers =
    team?.memberships?.map((m: any) => ({
      id: m.userId,
      name: m.user?.name ?? null,
      email: m.user?.email ?? null,
      image: m.user?.image ?? null,
    })) ?? [];

  return (
    <TeamSwitcher currentTeamId={user.selectedTeamId} userTeams={userTeams}>
      <div>
        <NoFundsAlert
          balanceCents={team?.balanceCents ?? 0}
          studyCostCents={studyCostCents}
          canPurchaseCredits={canPurchaseCredits}
          teamId={user.selectedTeamId}
          teamName={team?.name}
        />
        <ClaimCompanyAlert
          canClaimCompany={canClaimCompany}
          domain={domainInfo.domain}
        />
        {studies.length === 0 ? (
          <EmptyState
            isCompanyUser={isCompanyUser}
            hasJoinedCompanyTeams={hasJoinedCompanyTeams}
            companyName={domainInfo.company?.name}
          />
        ) : (
          <StudiesView
            studies={studiesWithPreviews}
            currentUserId={user.id}
            teamMembers={teamMembers}
            bookmarkedStudyIds={bookmarkedStudyIds}
          />
        )}
      </div>
    </TeamSwitcher>
  );
}
