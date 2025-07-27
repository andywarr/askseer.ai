// Next imports
import Image from "next/image";
import { redirect } from "next/navigation";

// Lib functions imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import { getStudies, getUser } from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/nextjs-app/lib/logger";

// UI component imports
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/apps/nextjs-app/components/ui/card";

import { StudyButton } from "@/apps/nextjs-app/components/study-button";

// Prisma imports
import { StudyType } from "@prisma/client";

export default async function Page() {
  try {
    const session = await isAuthenticated();

    if (!session) {
      logger.warn("User session not found", { session });
      redirect("/error");
    }

    logger.debug("User authentication completed", {
      userId: session.userId,
    });

    const user = await getUser(session.userId);

    // If a user does not exist there is a problem
    if (!user) {
      logger.error("User not found", { userId: session.userId });
      redirect("/error");
    }

    logger.debug("User retrieved successfully", {
      userId: user.id,
    });

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
                        "Walkthrough"}
                      {study.type === StudyType.HEURISTIC_EVALUATION &&
                        "Evaluation"}
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
  } catch (error) {
    logger.error("Failed to load studies page", {
      error: error instanceof Error ? error.message : String(error),
    });
    redirect("/error");
  }
}
