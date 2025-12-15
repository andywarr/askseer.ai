"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/apps/nextjs-app/components/ui/button";

type Props = {
  label: string; // Button label, e.g., "Evaluate" or "Create"
  credits: number;
  canPurchaseCredits?: boolean; // Whether user has permission to purchase credits
  loading?: boolean; // Optional loading state to auto-disable
  disabledOverride?: boolean; // If provided, overrides default disabled logic
  buttonType?: "submit" | "button" | "reset";
  className?: string; // Wrapper div className
  buttonClassName?: string; // Button className
};

export function FormSubmitWithCredits({
  label,
  credits,
  canPurchaseCredits = false,
  loading = false,
  disabledOverride,
  buttonType = "submit",
  className,
  buttonClassName,
}: Props) {
  // Button is disabled if:
  // 1. disabledOverride is explicitly set to true
  // 2. loading is true
  // 3. credits are 0 or less
  const disabled =
    typeof disabledOverride === "boolean"
      ? disabledOverride
      : !!loading || credits <= 0;

  // Determine if we should show the warning (credits running low)
  const showWarning = credits <= 9;

  // Determine color class based on credit level (matching app-sidebar)
  const colorClass =
    credits <= 1
      ? "text-red-500"
      : credits >= 2 && credits <= 9
        ? "text-amber-500"
        : "";

  // Determine message based on credit level and user permissions
  const getMessage = () => {
    if (credits === 0) {
      if (canPurchaseCredits) {
        return (
          <>
            0 credits remaining.{" "}
            <Link href="/credits" className="underline underline-offset-2">
              Purchase additional credits
            </Link>{" "}
            to run studies.
          </>
        );
      } else {
        return (
          <>
            0 credits remaining. Contact your team admin to purchase additional
            credits.
          </>
        );
      }
    } else {
      if (canPurchaseCredits) {
        return (
          <>
            {credits} {credits === 1 ? "credit" : "credits"} remaining.{" "}
            <Link href="/credits" className="underline underline-offset-2">
              Purchase additional credits
            </Link>
          </>
        );
      } else {
        return (
          <>
            {credits} {credits === 1 ? "credit" : "credits"} remaining.
          </>
        );
      }
    }
  };

  return (
    <div className={className ?? "flex items-end"}>
      <Button
        disabled={disabled}
        className={buttonClassName ?? "w-32"}
        type={buttonType}
      >
        {label}
      </Button>
      {showWarning && (
        <p className={`ml-3 text-xs font-medium ${colorClass}`}>
          {getMessage()}
        </p>
      )}
    </div>
  );
}

export default FormSubmitWithCredits;
