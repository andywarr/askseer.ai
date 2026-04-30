"use client";

import Link from "next/link";

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
  const teamLabel = teamName ?? "Your team";
  const costDisplay = `$${(costCents / 100).toFixed(2)}`;
  const balanceDisplay = `$${(balanceCents / 100).toFixed(2)}`;
  const label = costLabel
    ? `${costLabel} costs ${costDisplay}`
    : `This study costs ${costDisplay}`;

  if (canPurchaseCredits) {
    return (
      <p className="text-sm text-red-500 dark:text-red-400">
        Insufficient funds. {label} and your balance is {balanceDisplay}.{" "}
        <Link
          href="/funds"
          className="font-medium underline underline-offset-2 hover:text-red-700 dark:hover:text-red-300"
        >
          Manage Funds
        </Link>
      </p>
    );
  }

  return (
    <p className="text-sm text-red-500 dark:text-red-400">
      Insufficient funds. {label} (current balance: {balanceDisplay}). Please
      contact your {teamLabel} admin to add more.
    </p>
  );
}
