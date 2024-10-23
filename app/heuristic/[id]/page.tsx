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
import { getHeuristicEvaluation } from "@/app/lib/data";
import Image from "next/image";
import { isAuthenticated } from "@/app/lib/dal";
import { getPresignedUrls } from "@/app/lib/action";

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
          <Menu placement="bottom-end">
            <MenuHandler>
              <IconButton variant="text" ripple={false}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" />
                  <path d="M14 20C14 21.1046 13.1046 22 12 22C10.8954 22 10 21.1046 10 20C10 18.8954 10.8954 18 12 18C13.1046 18 14 18.8954 14 20Z" />
                  <path d="M14 4C14 5.10457 13.1046 6 12 6C10.8954 6 10 5.10457 10 4C10 2.89543 10.8954 2 12 2C13.1046 2 14 2.89543 14 4Z" />
                </svg>
              </IconButton>
            </MenuHandler>
            <MenuList className="flex flex-col gap-2">
              <MenuItem disabled>Share</MenuItem>
              <MenuItem>Delete</MenuItem>
            </MenuList>
          </Menu>
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
