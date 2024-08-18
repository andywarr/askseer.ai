import { auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/app/lib/data";
import { getHeuristicEvaluations } from "@/app/lib/data";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Typography,
} from "@/MTailwind";

export default async function Page() {
  const session = await auth();

  // If session does not exist the user should not be here
  if (!session) {
    redirect("/");
  }

  // If session.user does not exist there is a problem
  if (!session.user?.id) {
    return {
      redirect: {
        destination: "/error",
        permanent: false,
      },
    };
  }

  const user = await getUser(session.user?.id);

  // If user does not exist there is a problem
  if (user == null) {
    return {
      redirect: {
        destination: "/error",
        permanent: false,
      },
    };
  }

  const heuristicEvaluations = await getHeuristicEvaluations(user.id);

  return (
    <main className="container mx-auto px-4 py-6">
      <div className={heuristicEvaluations.length === 0 ? "flex justify-center" : "flex flex-wrap gap-4"}>
        {heuristicEvaluations.length === 0 ? (
          <div>
            <div className="italic mb-2 text-center">No results!</div>
            <Link className="underline" href="heuristic/new">Start your first heuristic evaluation.</Link>
          </div>
        ) : (
          heuristicEvaluations.map((heuristicEvaluation) => (
            <Card className="w-96" key={heuristicEvaluation.id}>
              <CardHeader className="relative mt-4 h-56">
                <Image
                  className="object-cover"
                  src={`data:image/png;base64, ${Buffer.from(heuristicEvaluation.files[0].fileData).toString("base64")}`}
                  fill
                  alt={`Preview of a screenshot from the flow to ${heuristicEvaluation.userGoal}`}
                />
              </CardHeader>
              <CardBody>
                <div className="flex">
                  <div className="flex-grow">
                    <Typography className="font-bold uppercase" variant="small">
                      {heuristicEvaluation.heuristic}
                    </Typography>
                    <Typography variant="h5">
                      {heuristicEvaluation.userGoal}
                    </Typography>
                  </div>
                  <div className="w-12 text-right">
                    <Typography
                      className={
                        heuristicEvaluation._count.results > 0
                          ? "text-red-500"
                          : ""
                      }
                      variant="h2"
                    >
                      {heuristicEvaluation._count.results}
                    </Typography>
                  </div>
                </div>
              </CardBody>
              <CardFooter className="pt-0">
                <Link href={`heuristic/${heuristicEvaluation.id}`}>
                  <Button variant="outlined">View results</Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
      <Link className="absolute bottom-0 right-0 m-6" href="heuristic/new">
        <Button
          className="drop-shadow-md h-16 w-16 cursor-pointer rounded-full p-0 text-center text-2xl text-white"
          size="lg"
        >
          +
        </Button>
      </Link>
    </main>
  );
}
