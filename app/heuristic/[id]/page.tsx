import { redirect } from "next/navigation";
import {
  Card,
  IconButton,
  Menu,
  MenuHandler,
  MenuItem,
  MenuList,
  Typography,
} from "@/MTailwind";
import {
  deleteHeuristicEvaluation,
  getHeuristicEvaluation,
} from "@/app/lib/data";
import Image from "next/image";
import { isAuthenticated } from "@/app/lib/dal";
import { deleteS3Objects, getPresignedUrls } from "@/app/lib/action";
import MoreMenu from "@/app/components/heuristic-evaluation-more-menu";

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
    <main className="container mx-auto px-4 py-6">
      <div className="mb-4 flex">
        <div className="flex-grow">
          <Typography variant="h5" className="flex h-full items-center">
            {heuristicEvaluation.userGoal}
          </Typography>
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
      <Typography className="mb-4" variant="h5">
        Results
      </Typography>
      <Card className="container mx-auto mb-6 h-full w-full overflow-scroll">
        <table className="w-full table-auto text-left">
          <thead>
            <tr>
              {TABLE_HEAD.map((head) => (
                <th
                  key={head}
                  className="border-b border-blue-gray-100 bg-blue-gray-50 p-4"
                >
                  <Typography
                    variant="small"
                    color="blue-gray"
                    className="font-normal leading-none opacity-70"
                  >
                    {head}
                  </Typography>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heuristicEvaluation.results.map(
              ({ id, heuristic, violated, reason }, index) => {
                const isLast = index === heuristicEvaluation.results.length - 1;
                const classes = isLast
                  ? "p-4"
                  : "p-4 border-b border-blue-gray-50";

                return (
                  <tr key={id} className="even:bg-blue-gray-50/50">
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                      >
                        {heuristic}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                      >
                        {violated === "yes" ? "Yes" : "No"}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                      >
                        {reason}
                      </Typography>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
