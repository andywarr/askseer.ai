"use client";

import React from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";

type Props = {
  label: string; // Button label, e.g., "Evaluate" or "Create"
  credits: number;
  loading?: boolean; // Optional loading state to auto-disable
  disabledOverride?: boolean; // If provided, overrides default disabled logic
  buttonType?: "submit" | "button" | "reset";
  className?: string; // Wrapper div className
  buttonClassName?: string; // Button className
};

export function FormSubmitWithCredits({
  label,
  credits,
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

  return (
    <div className={className ?? "flex"}>
      <Button
        disabled={disabled}
        className={buttonClassName ?? "w-32"}
        type={buttonType}
      >
        {label}
      </Button>
      <p className="ml-3 flex flex-wrap content-end">
        <span className="block text-xs font-light antialiased">
          {credits} {credits !== 1 ? "studies" : "study"} remaining. Contact{" "}
          payments@askseer.ai to purchase additional credits.
        </span>
      </p>
    </div>
  );
}

export default FormSubmitWithCredits;
