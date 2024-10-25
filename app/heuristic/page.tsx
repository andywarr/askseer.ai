import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/app/lib/data";
import { getHeuristicEvaluations } from "@/app/lib/data";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          {user.name ? `Welcome, ${user.name.split(" ")[0]}!` : `Welcome!`}
        </h1>
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
              <p className="leading-7 [&:not(:first-child)]:mt-6">
                Start your first heuristic evaluation.
              </p>
            </Link>
          </div>
        ) : (
          heuristicEvaluations.map(async (heuristicEvaluation) => (
            <Card className="w-96" key={heuristicEvaluation.id}>
              <CardHeader className="relative mt-4 h-56">
                <Image
                  className="object-cover"
                  src={await getPresignedUrls(heuristicEvaluation.files[0].key)}
                  fill
                  alt={`Preview of a screenshot from the flow to ${heuristicEvaluation.userGoal}`}
                  priority={true}
                  unoptimized={true}
                />
              </CardHeader>
              <CardContent>
                <div className="flex">
                  <div className="flex-grow">
                    <small className="text-sm font-bold uppercase leading-none">
                      {heuristicEvaluation.heuristic}
                    </small>
                    <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                      {heuristicEvaluation.userGoal}
                    </h4>
                  </div>
                  <div className="w-12 text-right">
                    <h2
                      className={`${
                        heuristicEvaluation._count.results > 0
                          ? "text-red-500"
                          : ""
                      } scroll-m-20 pb-2 text-3xl font-semibold tracking-tight first:mt-0`}
                    >
                      {heuristicEvaluation._count.results}
                    </h2>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Link href={`heuristic/${heuristicEvaluation.id}`}>
                  <Button variant="outline">View results</Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
