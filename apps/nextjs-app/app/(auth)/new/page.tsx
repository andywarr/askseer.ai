// Next imports
import Link from "next/link";

// Lib functions imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import { logger } from "@/apps/shared/logger";

// Lib functions imports
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/apps/nextjs-app/components/ui/card";

export default async function Page() {
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  logger.info("New study page rendered successfully", {
    userId: session.userId,
  });

  // Define study card data
  const studies = [
    {
      href: "/evaluation/new",
      title: "Evaluation",
      description:
        "Evaluate your interface against design best practices. Discover what works well and what could be improved for a better user experience.",
    },
    {
      href: "/walkthrough/new",
      title: "Walkthrough",
      description:
        "Test how easily users can navigate your product. Discover and fix obstacles that might prevent them from completing essential tasks.",
    },
    {
      href: "/persona/new",
      title: "Persona",
      description:
        "Define your target users and their needs. Focus on the user and explore how different user types interact with your product.",
    },
  ];

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
        {studies.map(({ href, title, description }) => (
          <Link key={href} href={href}>
            <Card className="h-full w-full hover:border-black">
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
