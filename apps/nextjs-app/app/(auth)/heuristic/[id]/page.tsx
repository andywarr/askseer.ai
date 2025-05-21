// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

// Lib function imports
import {
  convertFromHeuristicType,
  getPresignedUrls,
} from "@/apps/nextjs-app/lib/action";
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import {
  getHeuristicEvaluation,
  updateStudyName,
} from "@/apps/nextjs-app/lib/data";

// Components imports
import Gallery from "@/apps/nextjs-app/components/gallery";
import MoreMenu from "@/apps/nextjs-app/components/study-details-more-menu";
import Title from "@/apps/nextjs-app/components/title";
import HeuristicResults from "@/apps/nextjs-app/components/heuristic-results";

// UI component imports
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/apps/nextjs-app/components/ui/card";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";

// Prism imports
import { ViolatedType } from "@prisma/client";

// Type imports
import { HEResultData } from "@/apps/nextjs-app/types/types";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await isAuthenticated();

  const study = await getHeuristicEvaluation(params.id, session.userId);

  if (!study || !study.heuristicEvaluation) {
    redirect("/error");
  }

  if (session.userId !== study.userId) {
    // TODO: Need to redirect to a better page
    redirect("/error");
  }

  // Get presigned URLs for the study files
  const presignedUrls = await Promise.all(
    study.files.map((file: any) =>
      file.key ? getPresignedUrls(file.key) : "",
    ),
  );

  // Group the heuristic evaluation results by heuristic ID.
  const groupedResultsByHeuristic = study.heuristicEvaluation.results.reduce(
    (acc: { [key: string]: any[] }, result: any) => {
      if (!acc[result.heuristicId]) {
        acc[result.heuristicId] = [];
      }
      acc[result.heuristicId].push(result);
      return acc;
    },
    {},
  );

  // Sort each group by step if it exists
  Object.keys(groupedResultsByHeuristic).forEach((key) => {
    groupedResultsByHeuristic[key].sort((a, b) => {
      // If neither has a step, maintain original order
      if (a.step === undefined && b.step === undefined) return 0;
      // If only a is undefined, put it at the end
      if (a.step === undefined) return 1;
      // If only b is undefined, put it at the end
      if (b.step === undefined) return -1;
      // Both have steps, sort numerically
      return a.step - b.step;
    });
  });

  // Count violated heuristics
  const violated = Object.values(groupedResultsByHeuristic).filter((items) =>
    items.some((item) => item.violated === ViolatedType.YES),
  ).length;

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
            Heuristic Evaluation
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

      <div className="mb-4 flex">
        <div className="flex-grow">
          <p className="font-semibold leading-7 tracking-tight">User goal</p>
          <p className="leading-7">{study.heuristicEvaluation.goal}</p>
        </div>
      </div>

      <div className="mb-4 flex">
        <div className="flex-grow">
          <p className="font-semibold leading-7 tracking-tight">
            Additional context
          </p>
          <p className="leading-7">
            {study.heuristicEvaluation.context
              ? study.heuristicEvaluation.context
              : "None"}
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-nowrap items-center justify-between gap-4 overflow-x-auto">
        <Gallery presignedUrls={presignedUrls} />
      </div>

      <HeuristicResults
        groupedResultsByHeuristic={groupedResultsByHeuristic}
        violated={violated}
        type={convertFromHeuristicType(study.heuristicEvaluation.type)}
        presignedUrls={presignedUrls}
        files={study.files}
        studyId={study.id}
        userId={session.userId}
      />
    </div>
  );
}
