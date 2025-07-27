// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { getUser } from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/nextjs-app/lib/logger";

// Component imports
import { CognitiveWalkthroughForm } from "@/apps/nextjs-app/components/cognitive-walkthrough-form";

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
  try {
    const session = await isAuthenticated();

    if (!session) {
      logger.error("User session not found", { session });
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

    logger.info("New walkthrough page rendered successfully", {
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
              <BreadcrumbPage>New Walkthrough</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <CognitiveWalkthroughForm credits={user.credits} />
      </div>
    );
  } catch (error) {
    logger.error("Failed to load new walkthrough page", {
      error: error instanceof Error ? error.message : String(error),
    });
    redirect("/error");
  }
}
