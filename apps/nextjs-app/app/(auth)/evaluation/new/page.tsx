// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { getUser } from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/nextjs-app/lib/logger";

// Component imports
import { HeuristicEvaluationForm } from "@/apps/nextjs-app/components/heuristic-evaluation-form";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";

export default async function Page() {
  const session = await isAuthenticated();

  if (!session) {
    logger.error("User session not found", { session });
    redirect("/");
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

  logger.info("New evaluation page rendered successfully", {
    userId: user.id,
  });

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link href="/studies">Studies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Evaluation</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <HeuristicEvaluationForm credits={user.credits} />
    </div>
  );
}
