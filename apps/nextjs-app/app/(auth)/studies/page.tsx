// Lib functions imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import { getStudies } from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";

// Custom component imports
import { StudyPreviewCard } from "@/apps/nextjs-app/components/study-preview-card";

export default async function Page() {
  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  const studies = await getStudies(user.id, {
    teamId: user.selectedTeamId ?? undefined,
  });
  logger.info("Studies page rendered successfully", {
    userId: user.id,
    studyCount: studies.length,
  });

  const studyPreviews = await Promise.all(
    studies.map(async (study: any) => ({
      study,
      previewUrl:
        study.files && study.files.length > 0
          ? await getPresignedUrls(study.files[0].key)
          : null,
    })),
  );

  return (
    <div>
      <div className="mb-6 flex">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          {user.name ? `Welcome, ${user.name.split(" ")[0]}!` : `Welcome!`}
        </h1>
      </div>
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
          {studyPreviews.map(({ study, previewUrl }) => (
            <StudyPreviewCard
              key={study.id}
              study={study}
              currentUserId={user.id}
              previewUrl={previewUrl}
              imagePriority
            />
          ))}
        </div>
      )}
    </div>
  );
}
