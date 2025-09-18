"use client";

import * as React from "react";
import { OTPInput, SlotProps } from "input-otp";
import { cn } from "@/apps/nextjs-app/lib/utils";

export function InputOTP(
  props: React.ComponentProps<typeof OTPInput> & { className?: string },
) {
  const { className, ...rest } = props;
  return (
    <OTPInput containerClassName={cn("flex gap-2", className)} {...rest} />
  );
}

export function InputOTPSlot({ char, hasFakeCaret, isActive }: SlotProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-lg font-medium text-zinc-900",
        isActive && "ring-2 ring-zinc-800 ring-offset-2",
      )}
    >
      {char}
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink h-5 w-px bg-zinc-800" />
        </div>
      ) : null}
    </div>
  );
}

export function InputOTPGroup({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("flex gap-2", className)}>{children}</div>;
}
