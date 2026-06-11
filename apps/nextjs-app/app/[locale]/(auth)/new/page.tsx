// Next imports
import Link from "next/link";
import type { Metadata } from "next";

// Lib function imports
import {
  getCurrentUser,
  canManageTeamFunds,
} from "@/apps/nextjs-app/lib/db/user";
import { logger } from "@/apps/shared/logger";
import {
  PERSONAL_MIN_STUDY_COST_CENTS,
  COMPANY_MIN_STUDY_COST_CENTS,
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
import { getTranslations } from "next-intl/server";

// Static study metadata definition mapping keys (disabled state is computed at runtime)
interface StudyConfig {
  href: string;
  key: "analysis" | "evaluation" | "live" | "interview" | "persona" | "walkthrough";
  badge?: "new" | "preview";
}

const STUDY_CONFIGS: StudyConfig[] = [
  {
    href: "/analysis/new",
    key: "analysis",
    badge: "new",
  },
  {
    href: "/evaluation/new",
    key: "evaluation",
  },
  {
    href: "/live/new",
    key: "live",
    badge: "preview",
  },
  {
    href: "/interview/new",
    key: "interview",
    badge: "new",
  },
  {
    href: "/persona/new",
    key: "persona",
  },
  {
    href: "/walkthrough/new",
    key: "walkthrough",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NewStudyPage");
  return {
    title: `${t("title")} - Seer`,
    description: t("description"),
  };
}

export default async function Page() {
  const t = await getTranslations("NewStudyPage");

  // Get session data (authentication already verified in layout)
  const { user } = await getCurrentUser();

  // Fetch team, credits, and domain info in parallel
  const [team, canPurchaseCredits, domainInfo] = await Promise.all([
    user.selectedTeamId ? getTeam(user.selectedTeamId) : null,
    user.selectedTeamId
      ? canManageTeamFunds(user.id, user.selectedTeamId)
      : Promise.resolve(false),
    getCompanyByMyDomain(),
  ]);

  const studyCostCents = team?.companyId
    ? COMPANY_MIN_STUDY_COST_CENTS
    : PERSONAL_MIN_STUDY_COST_CENTS;

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

  // Build studies with runtime disabled states and translations
  const studies: StudyCardData[] = STUDY_CONFIGS.map((config) => {
    const isPersona = config.key === "persona";
    return {
      href: config.href,
      title: t(`studies.${config.key}.title`),
      description: t(`studies.${config.key}.description`),
      badge: config.badge ? t(`badges.${config.badge}`) : undefined,
      badgeType: config.badge,
      disabled: isPersona ? !canCreatePersonas : undefined,
      disabledMessage: isPersona && !canCreatePersonas ? t("disabledMessages.persona") : undefined,
    };
  });

  return (
    <div>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        {t("title")}
      </h2>
      <p className="mb-4">
        {t("description")}
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
