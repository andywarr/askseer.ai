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
import { isAuthenticated } from "../lib/dal";
import { getPresignedUrls } from "../lib/action";

export default async function Page() {
  const session = await isAuthenticated();

  const user = await getUser(session.userId);

  // If a user does not exist there is a problem
  if (!user) {
    redirect("/error");
  }

  const heuristicEvaluations = await getHeuristicEvaluations(user.id);

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="mb-6 flex">
        <Typography variant="h3">
          {user.name ? `Welcome, ${user.name.split(" ")[0]}!` : `Welcome!`}
        </Typography>
      </div>
      <div
        className={
          heuristicEvaluations.length === 0
            ? "flex justify-center"
            : "flex flex-wrap gap-4"
        }
      >
        {heuristicEvaluations.length === 0 ? (
          <div>
            <div className="mb-2 text-center italic">No results!</div>
            <Link className="underline" href="heuristic/new">
              Start your first heuristic evaluation.
            </Link>
          </div>
        ) : (
          heuristicEvaluations.map(async (heuristicEvaluation) => (
            <Card className="w-96" key={heuristicEvaluation.id}>
              <CardHeader className="relative mt-4 h-56">
                <Image
                  className="object-cover"
                  src={await getPresignedUrls(heuristicEvaluation.files[0].key)}
                  loading="eager"
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
    </main>
  );
}
