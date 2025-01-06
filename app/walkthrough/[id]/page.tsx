// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";

// Lib function imports
import { getPresignedUrls } from "@/lib/action";
import { isAuthenticated } from "@/lib/dal";
import { getCognitiveWalkthrough, updateStudyName } from "@/lib/data";

// Prism imports
import { StudyType } from "@prisma/client";

// Components imports
import { CognitiveWalkthroughDetails } from "@/components/cognitive-walkthrough-details";
import IssueCount from "@/components/issue-count";
import MoreMenu from "@/components/study-details-more-menu";

// Ui component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Title from "@/components/title";

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
    study.files.map((file) => (file.key ? getPresignedUrls(file.key) : "")),
  );

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
            {study.type === StudyType.COGNITIVE_WALKTHROUGH
              ? "Cognitive Walkthrough"
              : "Other"}
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
          <MoreMenu study={study} sessionId={session.userId} />
        </div>
      </div>

      <div className="mb-4 flex">
        <div className="flex-grow">
          <p className="font-semibold leading-7 tracking-tight">User goal</p>
          <p className="leading-7">{study.cognitiveWalkthrough.goal}</p>
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

      <div className="mb-4 flex justify-between">
        <IssueCount
          count={study.cognitiveWalkthrough.steps
            .slice(1)
            .reduce((count, step) => {
              return count + (step.expected === false ? 1 : 0);
            }, 0)}
          issue=" issue"
        />
        {/* <IssueCount
          count={study.cognitiveWalkthrough.steps.reduce((count, step) => {
            return (
              count +
              step.detail.filter(
                (detail) => detail.hasDiscoverabilityIssue === true,
              ).length
            );
          }, 0)}
          issue="discoverability issue"
        />

        <IssueCount
          count={study.cognitiveWalkthrough.steps.reduce((count, step) => {
            return (
              count +
              step.detail.filter(
                (detail) => detail.hasLearnabilityIssue === true,
              ).length
            );
          }, 0)}
          issue="learnability issue"
        />

        <IssueCount
          count={study.cognitiveWalkthrough.steps.reduce((count, step) => {
            return (
              count +
              step.detail.filter((detail) => detail.hasUsabilityIssue === true)
                .length
            );
          }, 0)}
          issue="usability issue"
        /> */}
      </div>

      <div className="mb-4 flex flex-col">
        {study.cognitiveWalkthrough.steps.map((step, index) => (
          <CognitiveWalkthroughDetails
            key={index}
            step={step.step}
            totalSteps={study.cognitiveWalkthrough?.steps.length ?? 0}
            expected={step.expected}
            questions={step.questions}
            imageUrl={presignedUrls[index]}
          />
        ))}
      </div>
    </div>
  );
}
