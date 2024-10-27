import { redirect } from "next/navigation";
import { getHeuristicEvaluation } from "@/app/lib/data";
import Image from "next/image";
import { isAuthenticated } from "@/app/lib/dal";
import { getPresignedUrls } from "@/app/lib/action";
import MoreMenu from "@/app/components/heuristic-evaluation-more-menu";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await isAuthenticated();

  const heuristicEvaluation = await getHeuristicEvaluation(
    params.id,
    session.userId,
  );

  if (!heuristicEvaluation) {
    redirect("/error");
  }

  if (session.userId !== heuristicEvaluation.userId) {
    // TODO: Need to redirect to a better page
    redirect("/error");
  }

  const TABLE_HEAD = ["Heuristic", "Violated", "Reason"];

  const presignedUrls = await Promise.all(
    heuristicEvaluation.files.map((file) =>
      file.key ? getPresignedUrls(file.key) : "",
    ),
  );

  return (
    <div>
      <div className="mb-4 flex">
        <div className="flex-grow">
          <h2 className="flex h-full scroll-m-20 items-center pb-2 text-3xl font-semibold tracking-tight first:mt-0">
            {heuristicEvaluation.userGoal}
          </h2>
        </div>
        <div className="ml-4 flex">
          <MoreMenu
            heuristicEvaluation={heuristicEvaluation}
            sessionId={session.userId}
          />
        </div>
      </div>

      <div className="mb-8 flex max-h-64 flex-nowrap items-center justify-between gap-4 overflow-x-auto">
        {presignedUrls.map((url, index) => (
          <div className="max-w-full flex-grow shadow" key={index}>
            <Image
              src={url}
              alt={`Preview of a screenshot from the flow to ${heuristicEvaluation.userGoal}`}
              width={500} // Placeholder width
              height={500} // Placeholder height
              className="h-auto w-full object-contain"
              priority={true}
              unoptimized={true}
            />
          </div>
        ))}
      </div>
      <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
        Results
      </h4>
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
            {heuristicEvaluation.results.map(
              ({ id, heuristic, violated, reason }, index) => {
                return (
                  <TableRow
                    key={id}
                    className={
                      violated === "yes" ? "bg-red-300 hover:bg-red-400" : ""
                    }
                  >
                    <TableCell>{heuristic}</TableCell>
                    <TableCell>{violated === "yes" ? "Yes" : "No"}</TableCell>
                    <TableCell>{reason}</TableCell>
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
