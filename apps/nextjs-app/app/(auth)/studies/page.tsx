// Next imports
import Image from "next/image";
import { redirect } from "next/navigation";

// Lib functions imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import { getStudies } from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";

// UI component imports
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/apps/nextjs-app/components/ui/card";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

// Custom component imports
import { StudyButton } from "@/apps/nextjs-app/components/study-button";

// Prisma imports
import { StudyType } from "@prisma/client";

export default async function Page() {
  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  const studies = await getStudies(user.id);
  logger.info("Studies page rendered successfully", {
    userId: user.id,
    studyCount: studies.length,
  });

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
              "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
          }}
        >
          {studies.map(async (study: any) => (
            <Card
              className="w-full gap-3 overflow-hidden pt-0 pb-6"
              key={study.id}
            >
              <CardHeader className="relative h-56">
                {study.files && study.files.length > 0 ? (
                  <Image
                    className="object-cover"
                    src={await getPresignedUrls(study.files[0].key)}
                    fill
                    alt={`Preview of a screenshot from the flow`}
                    priority={true}
                    unoptimized={true}
                  />
                ) : (
                  <Skeleton className="absolute inset-0" />
                )}
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex flex-col">
                  <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
                    {study.type === StudyType.COGNITIVE_WALKTHROUGH &&
                      "Walkthrough"}
                    {study.type === StudyType.HEURISTIC_EVALUATION &&
                      "Evaluation"}
                    {study.type === StudyType.PERSONA && "Persona"}
                  </small>
                  <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                    {study.name ? study.name : "Untitled"}
                  </h4>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <StudyButton
                  id={study.id}
                  status={study.status}
                  type={study.type}
                  userId={user.id}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
