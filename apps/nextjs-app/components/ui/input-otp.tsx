"use client";

import * as React from "react";
import {
  OTPInput,
  OTPInputContext,
} from "input-otp";

import { cn } from "@/apps/nextjs-app/lib/utils";

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    className={className}
    containerClassName={cn("flex items-center gap-2", containerClassName)}
    {...props}
  />
));
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2", className)}
    {...props}
  />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, children = "-", ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    aria-hidden="true"
    className={cn("flex w-4 justify-center text-muted-foreground", className)}
    {...props}
  >
    {children}
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const { slots } = React.useContext(OTPInputContext);
  const slot = slots[index];

  const showCaret = slot?.hasFakeCaret && !slot?.char;
  const displayValue = slot?.char ?? slot?.placeholderChar ?? "";

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-12 w-12 items-center justify-center rounded-md border border-input bg-background text-2xl font-medium uppercase shadow-sm transition-colors",
        slot?.isActive && "ring-2 ring-ring ring-offset-2",
        className,
      )}
      {...props}
    >
      {showCaret ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-6 w-px animate-pulse bg-foreground" />
        </span>
      ) : (
        <span
          className={cn(
            "text-foreground",
            !slot?.char && "text-muted-foreground",
          )}
        >
          {displayValue || "•"}
        </span>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
