// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { logger } from "@/apps/nextjs-app/lib/logger";

// Lib functions imports
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/apps/nextjs-app/components/ui/card";

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

    logger.info("New study page rendered successfully", {
      userId: session.userId,
    });

    return (
      <div>
        <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
          Unlock Insights
        </h2>
        <p className="mb-4">
          Select an AI-assisted research study that best suits your needs to
          unlock insights.
        </p>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
          }}
        >
          <Link href="/walkthrough/new">
            <Card className="h-full w-full hover:border-black">
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center justify-between">
                    <span>Walkthrough</span>
                  </div>
                </CardTitle>
                <CardDescription>
                  Test how easily users can navigate your product. Discover and
                  fix obstacles that might prevent them from completing
                  essential tasks.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/evaluation/new">
            <Card className="h-full w-full hover:border-black">
              <CardHeader>
                <CardTitle>Evaluation</CardTitle>
                <CardDescription>
                  Evaluate your interface against design best practices.
                  Discover what works well and what could be improved for a
                  better user experience.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    );
  } catch (error) {
    logger.error("Failed to load new study page", {
      error: error instanceof Error ? error.message : String(error),
    });
    redirect("/error");
  }
}
