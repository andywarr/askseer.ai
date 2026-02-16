// Next imports
import Link from "next/link";
import type { Metadata } from "next";

// Lib function imports
import {
  getCurrentUser,
  canUserPurchaseCredits,
} from "@/apps/nextjs-app/lib/db/user";
import { logger } from "@/apps/shared/logger";
import {
  PERSONAL_STUDY_COST_CENTS,
  COMPANY_STUDY_COST_CENTS,
} from "@/apps/shared/constants";

// UI component imports
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getTeam,
} from "@/apps/nextjs-app/lib/db/data";
import { NoFundsAlert } from "@/apps/nextjs-app/components/funds/no-funds-alert";
import { StudyCard, type StudyCardData } from "./study-card";

// Static study metadata (disabled state is computed at runtime)
const BASE_STUDIES: Omit<StudyCardData, "disabled" | "disabledMessage">[] = [
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

export const metadata: Metadata = {
  title: "New Study - Seer",
  description:
    "Start a new evaluation, walkthrough, or persona study to unlock insights about your product.",
};

export default async function Page() {
  // Get session data (authentication already verified in layout)
  const { user } = await getCurrentUser();

  // Fetch team, credits, and domain info in parallel
  const [team, canPurchaseCredits, domainInfo] = await Promise.all([
    user.selectedTeamId ? getTeam(user.selectedTeamId) : null,
    canUserPurchaseCredits(user.id),
    getCompanyByMyDomain(),
  ]);

  const studyCostCents = team?.companyId
    ? COMPANY_STUDY_COST_CENTS
    : PERSONAL_STUDY_COST_CENTS;

  let canCreatePersonas = true;
  if (domainInfo.company?.id) {
    try {
      const members = await getCompanyMembers(domainInfo.company.id);
      const membership = members.find((member) => member.userId === user.id);
      if (membership) {
        canCreatePersonas = membership.canCreatePersonas;
      }
    } catch (error) {
      logger.warn("Unable to determine persona permissions", {
        userId: user.id,
        error,
      });
    }
  }

  logger.info("New study page rendered successfully", {
    userId: user.id,
  });

  // Build studies with runtime disabled states
  const studies: StudyCardData[] = BASE_STUDIES.map((study) => {
    if (study.href === "/persona/new") {
      return {
        ...study,
        disabled: !canCreatePersonas,
        disabledMessage: "Persona creation has been disabled by your admin.",
      };
    }
    return study;
  });

  return (
    <div>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Unlock Insights
      </h2>
      <p className="mb-4">
        Select the option that best suits your needs to start unlocking
        insights.
      </p>
      <NoFundsAlert
        balanceCents={team?.balanceCents ?? 0}
        studyCostCents={studyCostCents}
        canPurchaseCredits={canPurchaseCredits}
        teamId={user.selectedTeamId}
        teamName={team?.name}
      />
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
        }}
      >
        {studies.map((study) => (
          <StudyCard key={study.href} study={study} />
        ))}
      </div>
    </div>
  );
}
