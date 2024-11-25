// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";

// Lib function imports
import { convertFromHeuristicType, getPresignedUrls } from "@/app/lib/action";
import { isAuthenticated } from "@/app/lib/dal";
import { getHeuristicEvaluation, updateStudyName } from "@/app/lib/data";

// Components imports
import MoreMenu from "@/app/components/heuristic-evaluation-more-menu";

// Ui component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import Gallery from "@/app/components/Gallery";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ViolatedType, StudyType } from "@prisma/client";
import Title from "@/app/components/Title";

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

  const TABLE_HEAD = ["Heuristic", "Violated", "Reason", "Recommendation"];

  const presignedUrls = await Promise.all(
    study.files.map((file) => (file.key ? getPresignedUrls(file.key) : "")),
  );

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link href="/heuristic">Studies</Link>
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
            {study.type === StudyType.HEURISTIC_EVALUATION
              ? "Heuristic Evaluation"
              : "Other"}
          </small>
          <Title
            studyId={study.id}
            userId={session.userId}
            updateStudyName={updateStudyName}
          >
            {study.name ? study.name : "Untitled"}
          </Title>
          {/* <h2 className="flex h-full scroll-m-20 items-center pb-2 text-3xl font-semibold tracking-tight first:mt-0">
            {study.name ? study.name : "Untitled"}
          </h2> */}
        </div>
        <div className="ml-4 flex">
          <MoreMenu study={study} sessionId={session.userId} />
        </div>
      </div>

      <div className="mb-4 flex">
        <div className="flex-grow">
          <p className="font-semibold leading-7 tracking-tight">User goal</p>
          <p className="leading-7">{study.heuristicEvaluation.goal}</p>
        </div>
      </div>

      <div className="mb-8 flex max-h-64 flex-nowrap items-center justify-between gap-4 overflow-x-auto">
        <Gallery presignedUrls={presignedUrls} />
      </div>

      <div className="mb-4 flex">
        <div className="flex-grow">
          <p className="font-semibold leading-7 tracking-tight">Heuristics</p>
          <p className="leading-7">
            {convertFromHeuristicType(study.heuristicEvaluation.type)}
          </p>
        </div>
        <div className="flex">
          <p
            className={`${
              study.heuristicEvaluation.results.filter(
                (result) => result.violated === ViolatedType.YES,
              ).length > 0
                ? "text-red-500"
                : ""
            }`}
          >
            <span className="text-4xl">
              {`${
                study.heuristicEvaluation.results.filter(
                  (result) => result.violated === ViolatedType.YES,
                ).length
              }`}
            </span>
            <span>
              {` violated ${
                study.heuristicEvaluation.results.filter(
                  (result) => result.violated === ViolatedType.YES,
                ).length > 1
                  ? "heuristics"
                  : "heuristic"
              }
              `}
            </span>
          </p>
        </div>
      </div>

      <Card className="container mx-auto mb-6 h-full w-full overflow-scroll">
        <Table>
          <TableHeader>
            <TableRow>
              {TABLE_HEAD.map((head, index) => (
                <TableHead key={index}>{head}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {study.heuristicEvaluation.results.map(
              (
                { id, violated, reason, source, heuristic, recommendations },
                index,
              ) => {
                return (
                  <TableRow
                    key={id}
                    className={
                      violated === ViolatedType.YES
                        ? "bg-red-300 hover:bg-red-300"
                        : ""
                    }
                  >
                    <TableCell>{heuristic.heuristic}</TableCell>
                    <TableCell>
                      {violated === ViolatedType.YES ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>{reason}</TableCell>
                    <TableCell>
                      {recommendations[0].recommendation
                        ? recommendations[0].recommendation
                        : ""}
                    </TableCell>
                  </TableRow>
                );
              },
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
