import { auth } from "@/auth";
import { redirect } from 'next/navigation'
import { Card, Typography } from "@/MTailwind";
import { getHeuristicEvaluation } from "@/app/lib/data";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await auth();

  // If session does not exist the user should not be here
  if (!session) {
    redirect("/");
  }

  // If session.user does not exist there is a problem
  if (!session.user?.id) {
    return {
      redirect: {
        destination: '/error',
        permanent: false,
      },
    };
  }

  // TODO: Need to check if the user is authorized

  const heuristicEvaluation = await getHeuristicEvaluation(params.id);

  console.log(heuristicEvaluation);

  const TABLE_HEAD = ["Heuristic", "Violated", "Reason"];

  return (
  <main className="container mx-auto px-4 py-6">
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
            {heuristicEvaluation.results.map(({id, heuristic, violated, reason}, index) => {
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
