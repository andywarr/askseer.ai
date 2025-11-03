import { ProjectsManager } from "@/apps/nextjs-app/components/projects-manager";
import { getProjects, getStudies, getTeam } from "@/apps/nextjs-app/lib/data";
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user } = await getCurrentUser();
  const teamId = user.selectedTeamId;

  const [projects, studies] = await Promise.all([
    getProjects(user.id, teamId),
    getStudies(user.id, { teamId }),
  ]);

  const studySummaries = Array.isArray(studies)
    ? studies.map((study: any) => ({
        id: study.id,
        name: study.name ?? null,
        status: study.status,
        type: study.type,
        createdByUserId: study.createdByUserId,
      }))
    : [];

  const projectSummaries = Array.isArray(projects) ? projects : [];

  return (
    <ProjectsManager
      projects={projectSummaries}
      studies={studySummaries}
      currentUserId={user.id}
      teamId={teamId}
    />
  );
}
