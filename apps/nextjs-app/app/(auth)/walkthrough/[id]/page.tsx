// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";

// Lib function imports
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import {
  getCognitiveWalkthrough,
  updateStudyName,
} from "@/apps/nextjs-app/lib/data";
import {
  handleCreateCWRecommendation,
  handleDeleteCWRecommendation,
  handleCreateCWIssue,
} from "@/apps/nextjs-app/lib/cognitive-walkthrough-actions";

// Prism imports
import { StudyType } from "@prisma/client";

// Components imports
import { CognitiveWalkthroughClient } from "@/apps/nextjs-app/components/cognitive-walkthrough-client";
import MoreMenu from "@/apps/nextjs-app/components/study-details-more-menu";

// Ui component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";
import Title from "@/apps/nextjs-app/components/title";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await isAuthenticated();

  const study = await getCognitiveWalkthrough(params.id, session.userId);

  if (!study) {
    redirect("/error");
    return;
  }

  if (!study.cognitiveWalkthrough) {
    redirect("/error");
    return;
  }

  if (session.userId !== study.userId) {
    // TODO: Need to redirect to a better page
    redirect("/error");
  }

  const presignedUrls = await Promise.all(
    study.files.map((file: any) =>
      file.key ? getPresignedUrls(file.key) : "",
    ),
  );

  study.cognitiveWalkthrough.steps.forEach((step, index) => {
    console.log(`Step ${index + 1}:`, step);
  });

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link href="/studies">Studies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Results</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 flex">
        <div className="flex flex-grow flex-col">
          <small className="text-sm font-bold uppercase leading-none text-zinc-500">
            Walkthrough
          </small>
          <Title
            studyId={study.id}
            userId={session.userId}
            updateStudyName={updateStudyName}
          >
            {study.name ? study.name : "Untitled"}
          </Title>
        </div>
        <div className="ml-4 flex">
          <MoreMenu study={study} userId={session.userId} />
        </div>
      </div>

      <div className="mb-8 rounded-lg bg-gray-100 p-6">
        <div className="mb-4 flex">
          <div className="flex-grow">
            <p className="font-semibold leading-7 tracking-tight">User goal</p>
            <p className="leading-7">{study.cognitiveWalkthrough.goal}</p>
          </div>
        </div>

        <div className="mb-4 flex">
          <div className="flex-grow">
            <p className="font-semibold leading-7 tracking-tight">
              Target user
            </p>
            <p className="leading-7">
              {study.cognitiveWalkthrough.user
                ? study.cognitiveWalkthrough.user
                : "Not defined"}
            </p>
          </div>
        </div>

        <div className="mb-4 flex">
          <div className="flex-grow">
            <p className="font-semibold leading-7 tracking-tight">
              Additional context
            </p>
            <p className="leading-7">
              {study.cognitiveWalkthrough.context
                ? study.cognitiveWalkthrough.context
                : "None"}
            </p>
          </div>
        </div>
      </div>

      <CognitiveWalkthroughClient
        initialSteps={study.cognitiveWalkthrough.steps}
        presignedUrls={presignedUrls}
        totalSteps={study.cognitiveWalkthrough?.steps.length ?? 0}
        studyId={study.id}
        userId={session.userId}
        onCreateIssue={async (
          stepId: string,
          issueType: string,
          content: string,
        ) => {
          "use server";
          await handleCreateCWIssue(stepId, issueType, content, async () => {});
        }}
        onCreateRecommendation={async (issueId: string, content: string) => {
          "use server";
          await handleCreateCWRecommendation(issueId, content, async () => {});
        }}
        onDeleteRecommendation={async (
          issueId: string,
          recommendationId: string,
        ) => {
          "use server";
          await handleDeleteCWRecommendation(recommendationId, async () => {});
        }}
      />
    </div>
  );
}
