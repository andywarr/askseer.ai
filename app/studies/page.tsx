// Next imports
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import { isAuthenticated } from "../../lib/dal";
import { getPresignedUrls } from "../../lib/action";
import { getStudies, getUser } from "@/lib/data";

// UI component imports
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { StudyType } from "@prisma/client";

export default async function Page() {
  const session = await isAuthenticated();

  const user = await getUser(session.userId);

  // If a user does not exist there is a problem
  if (!user) {
    redirect("/error");
  }

  const studies = await getStudies(user.id);

  return (
    <div>
      <div className="mb-6 flex">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          {user.name ? `Welcome, ${user.name.split(" ")[0]}!` : `Welcome!`}
        </h1>
      </div>
      {studies.length === 0 ? (
        <div className="flex justify-center">
          <div className="mb-2 text-center italic">No studies!</div>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(w-96, 100%), 1fr))",
          }}
        >
          {studies.map(async (study) => (
            <Card className="w-full" key={study.id}>
              <CardHeader className="relative mt-4 h-56">
                <Image
                  className="object-cover"
                  src={await getPresignedUrls(study.files[0].key)}
                  fill
                  alt={`Preview of a screenshot from the flow`}
                  priority={true}
                  unoptimized={true}
                />
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex flex-col">
                  <small className="text-sm font-bold uppercase leading-none text-zinc-500">
                    {study.type === StudyType.COGNITIVE_WALKTHROUGH &&
                      "Cognitive Walkthrough"}
                    {study.type === StudyType.HEURISTIC_EVALUATION &&
                      "Heuristic Evaluation"}
                  </small>
                  <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                    {study.name ? study.name : "Untitled"}
                  </h4>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                {study.type === StudyType.COGNITIVE_WALKTHROUGH && (
                  <Link href={`walkthrough/${study.id}`}>
                    <Button variant="outline">View results</Button>
                  </Link>
                )}
                {study.type === StudyType.HEURISTIC_EVALUATION && (
                  <Link href={`heuristic/${study.id}`}>
                    <Button variant="outline">View results</Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
