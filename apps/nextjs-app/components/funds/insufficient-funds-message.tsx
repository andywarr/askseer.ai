"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

interface InsufficientFundsMessageProps {
  balanceCents: number;
  costCents: number;
  canPurchaseCredits?: boolean;
  teamName?: string | null;
  /** Optional label for the cost, e.g. "3 sessions" — defaults to "This study" */
  costLabel?: string;
}

/**
 * Inline message displayed below the submit button when the team has
 * insufficient funds. Shows role-appropriate messaging:
 * - Admins who can purchase credits see a "Manage Funds" link
 * - Others are told to contact their admin
 */
export function InsufficientFundsMessage({
  balanceCents,
  costCents,
  canPurchaseCredits,
  teamName,
  costLabel,
}: InsufficientFundsMessageProps) {
  const t = useTranslations("SharedStudyComponents.insufficientFunds");
  const locale = useLocale();

  const costDisplay = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(costCents / 100);

  const balanceDisplay = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(balanceCents / 100);

  const getLocalizedHref = (href: string) => {
    if (locale === "en") return href;
    return `/${locale}${href === "/" ? "" : href}`;
  };

  const costLabelText = costLabel
    ? t("costLabelSuffix", { costLabel, costDisplay })
    : t("defaultCostSuffix", { costDisplay });

  const teamLabelText = teamName ?? t("defaultTeamLabel");

  if (canPurchaseCredits) {
    return (
      <p className="text-sm text-red-500 dark:text-red-400">
        {t("adminMessage", { label: costLabelText, balance: balanceDisplay })}{" "}
        <Link
          href={getLocalizedHref("/funds")}
          className="font-medium underline underline-offset-2 hover:text-red-700 dark:hover:text-red-300"
        >
          {t("manageFunds")}
        </Link>
      </p>
    );
  }

  return (
    <p className="text-sm text-red-500 dark:text-red-400">
      {t("nonAdminMessage", {
        label: costLabelText,
        balance: balanceDisplay,
        teamLabel: teamLabelText,
      })}
    </p>
  );
}
