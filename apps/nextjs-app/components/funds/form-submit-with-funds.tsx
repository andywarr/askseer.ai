"use client";

import React from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";

type Props = {
  label: string; // Button label, e.g., "Evaluate" or "Create"
  balanceCents: number;
  loading?: boolean; // Optional loading state to auto-disable
  disabledOverride?: boolean; // If provided, overrides default disabled logic
  buttonType?: "submit" | "button" | "reset";
  className?: string; // Wrapper div className
  buttonClassName?: string; // Button className
};

export function FormSubmitWithFunds({
  label,
  balanceCents,
  loading = false,
  disabledOverride,
  buttonType = "submit",
  className,
  buttonClassName,
}: Props) {
  // Button is disabled if:
  // 1. disabledOverride is explicitly set to true
  // 2. loading is true
  // 3. balance is 0 or less
  const disabled =
    typeof disabledOverride === "boolean"
      ? disabledOverride
      : !!loading || balanceCents <= 0;

  return (
    <div className={className ?? "flex items-end"}>
      <Button
        disabled={disabled}
        className={buttonClassName ?? "w-32"}
        type={buttonType}
      >
        {label}
      </Button>
    </div>
  );
}

export default FormSubmitWithFunds;
