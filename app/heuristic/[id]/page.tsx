import { auth } from "@/auth";
import { redirect } from 'next/navigation'
import { Card, Typography } from "@/MTailwind";
import { getHeuristicEvaluation } from "@/app/lib/data";
import Image from "next/image";
import { isAuthenticated } from "@/app/lib/dal";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await isAuthenticated();

  const heuristicEvaluation = await getHeuristicEvaluation(params.id);

  if (!heuristicEvaluation) {
    redirect('/error');
  }

  if(session.userId !== heuristicEvaluation.userId) {
    // TODO: Need to redirect to a better page
    redirect('/error')
  }

  const TABLE_HEAD = ["Heuristic", "Violated", "Reason"];

  return (
    <main className="container mx-auto px-4 py-6">
      <Typography
        className="mb-4"
        variant="h5"
      >{heuristicEvaluation.userGoal}</Typography>
      <div className="flex flex-nowrap gap-4 justify-start mb-8">
        {heuristicEvaluation.files.map((file) => (
          <div className="relative h-auto shadow" key={file.id}>
            <Image
              className="max-h-64 w-auto"
              src={`data:image/png;base64, ${Buffer.from(file.fileData).toString("base64")}`}
              alt={`Preview of a screenshot from the flow to ${heuristicEvaluation.userGoal}`}
              width={500}
              height={500}
              objectFit="contain"
            />
          </div>
        ))}
      </div>
      <Typography
        className="mb-4"
        variant="h5"
      >Results</Typography>
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
            {heuristicEvaluation.results.map(({ id, heuristic, violated, reason }, index) => {
              const isLast = index === heuristicEvaluation.results.length - 1;
              const classes = isLast ? "p-4" : "p-4 border-b border-blue-gray-50";

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
                      {violated === 'yes' ? 'Yes' : 'No'}
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
            })}
          </tbody>
        </table>
      </Card>
    </main>
  )
}
