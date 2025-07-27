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
import { logger } from "@/apps/nextjs-app/lib/logger";

// Components imports
import { CognitiveWalkthroughClient } from "@/apps/nextjs-app/components/cognitive-walkthrough-client";
import Gallery from "@/apps/nextjs-app/components/gallery";
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
  try {
    const session = await isAuthenticated();
    logger.debug("User authentication completed", {
      userId: session.userId,
      studyId: params.id,
    });

    const study = await getCognitiveWalkthrough(params.id, session.userId);

    if (!study) {
      logger.warn("Study not found", {
        userId: session.userId,
        studyId: params.id,
      });
      redirect("/error");
    }

    if (!study.cognitiveWalkthrough) {
      logger.warn("Cognitive walkthrough data not found", {
        userId: session.userId,
        studyId: params.id,
      });
      redirect("/error");
    }

    if (session.userId !== study.userId) {
      logger.warn("Unauthorized access attempt", {
        studyId: params.id,
        studyOwnerId: study.userId,
        requestingUserId: session.userId,
      });
      // TODO: Need to redirect to a better page
      redirect("/error");
    }

    logger.debug("Study retrieved successfully", {
      userId: session.userId,
      studyId: study.id,
      stepCount: study.cognitiveWalkthrough.steps.length,
      fileCount: study.files.length,
    });

    const presignedUrls = await Promise.all(
      study.files.map((file: any) =>
        file.key ? getPresignedUrls(file.key) : "",
      ),
    );

    logger.debug("Presigned URLs generated", {
      userId: session.userId,
      studyId: study.id,
      fileCount: presignedUrls.length,
    });

    logger.info("Walkthrough page rendered successfully", {
      userId: session.userId,
      studyId: study.id,
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

        <div className="mb-8 rounded-lg bg-gray-100 p-6 text-sm">
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="font-semibold leading-5 tracking-tight">
                User goal
              </p>
              <p className="leading-5">{study.cognitiveWalkthrough.goal}</p>
            </div>

            <div>
              <p className="font-semibold leading-5 tracking-tight">
                Target user
              </p>
              <p className="leading-5">
                {study.cognitiveWalkthrough.user
                  ? study.cognitiveWalkthrough.user
                  : "Not defined"}
              </p>
            </div>
          </div>

          <div className="mb-4 flex">
            <div className="flex-grow">
              <p className="font-semibold leading-5 tracking-tight">
                Additional context
              </p>
              <p className="leading-5">
                {study.cognitiveWalkthrough.context
                  ? study.cognitiveWalkthrough.context
                  : "None"}
              </p>
            </div>
          </div>

          <div className="flex flex-nowrap gap-4 overflow-x-auto">
            <Gallery presignedUrls={presignedUrls} />
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
            try {
              await handleCreateCWIssue(
                stepId,
                issueType,
                content,
                async () => {},
              );
              logger.debug("Cognitive walkthrough issue created successfully", {
                userId: session.userId,
                studyId: study.id,
              });
            } catch (error) {
              logger.error("Failed to create cognitive walkthrough issue", {
                userId: session.userId,
                studyId: study.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }}
          onCreateRecommendation={async (issueId: string, content: string) => {
            "use server";
            try {
              await handleCreateCWRecommendation(
                issueId,
                content,
                async () => {},
              );
              logger.debug(
                "Cognitive walkthrough recommendation created successfully",
                {
                  userId: session.userId,
                  studyId: study.id,
                  issueId,
                },
              );
            } catch (error) {
              logger.error(
                "Failed to create cognitive walkthrough recommendation",
                {
                  userId: session.userId,
                  studyId: study.id,
                  issueId,
                  error: error instanceof Error ? error.message : String(error),
                },
              );
            }
          }}
          onDeleteRecommendation={async (
            issueId: string,
            recommendationId: string,
          ) => {
            "use server";
            try {
              await handleDeleteCWRecommendation(
                recommendationId,
                async () => {},
              );
              logger.debug(
                "Cognitive walkthrough recommendation deleted successfully",
                {
                  userId: session.userId,
                  studyId: study.id,
                  issueId,
                  recommendationId,
                },
              );
            } catch (error) {
              logger.error(
                "Failed to delete cognitive walkthrough recommendation",
                {
                  userId: session.userId,
                  studyId: study.id,
                  issueId,
                  recommendationId,
                  error: error instanceof Error ? error.message : String(error),
                },
              );
            }
          }}
        />
      </div>
    );
  } catch (error) {
    logger.error("Failed to load walkthrough page", {
      studyId: params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    redirect("/error");
  }
}
