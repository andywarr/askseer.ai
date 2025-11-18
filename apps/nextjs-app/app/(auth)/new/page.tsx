// Next imports
import Link from "next/link";

// Lib functions imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { logger } from "@/apps/shared/logger";

// Lib functions imports
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/apps/nextjs-app/components/ui/card";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
} from "@/apps/nextjs-app/lib/data";

export default async function Page() {
  // Get session data (authentication already verified in layout)
  const { user } = await getCurrentUser();

  let canCreatePersonas = true;
  try {
    const domainInfo = await getCompanyByMyDomain();
    if (domainInfo.company?.id) {
      const members = await getCompanyMembers(domainInfo.company.id);
      const membership = members.find((member) => member.userId === user.id);
      if (membership) {
        canCreatePersonas = membership.canCreatePersonas;
      }
    }
  } catch (error) {
    logger.warn("Unable to determine persona permissions", {
      userId: user.id,
      error,
    });
  }

  logger.info("New study page rendered successfully", {
    userId: user.id,
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
      disabled: !canCreatePersonas,
      disabledMessage: "Persona creation has been disabled for your account.",
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
        {studies.map(({
          href,
          title,
          description,
          disabled,
          disabledMessage,
        }) => {
          const card = (
            <Card
              className={`h-full w-full ${
                disabled ? "cursor-not-allowed opacity-60" : "hover:border-black"
              }`}
              aria-disabled={disabled}
            >
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
                {disabled && disabledMessage && (
                  <p className="pt-2 text-sm text-muted-foreground">
                    {disabledMessage}
                  </p>
                )}
              </CardHeader>
            </Card>
          );
          return disabled ? (
            <div key={href} aria-disabled className="pointer-events-none">
              {card}
            </div>
          ) : (
            <Link key={href} href={href}>
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
