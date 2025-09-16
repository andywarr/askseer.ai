"use client";

import * as React from "react";
import * as InputOTPPrimitive from "input-otp";

import { cn } from "@/apps/nextjs-app/lib/utils";

const InputOTP = React.forwardRef<
  React.ElementRef<typeof InputOTPPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof InputOTPPrimitive.Root>
>(({ className, ...props }, ref) => (
  <InputOTPPrimitive.Root
    ref={ref}
    className={cn("flex items-center gap-2", className)}
    {...props}
  />
));
InputOTP.displayName = InputOTPPrimitive.Root.displayName;

const InputOTPGroup = React.forwardRef<
  React.ElementRef<typeof InputOTPPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof InputOTPPrimitive.Group>
>(({ className, ...props }, ref) => (
  <InputOTPPrimitive.Group
    ref={ref}
    className={cn("flex items-center gap-2", className)}
    {...props}
  />
));
InputOTPGroup.displayName = InputOTPPrimitive.Group.displayName;

const InputOTPSlot = React.forwardRef<
  React.ElementRef<typeof InputOTPPrimitive.Slot>,
  React.ComponentPropsWithoutRef<typeof InputOTPPrimitive.Slot>
>(({ className, ...props }, ref) => (
  <InputOTPPrimitive.Slot
    ref={ref}
    className={cn(
      "flex h-12 w-12 items-center justify-center rounded-md border border-input bg-background text-2xl font-medium uppercase shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
InputOTPSlot.displayName = InputOTPPrimitive.Slot.displayName;

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<typeof InputOTPPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof InputOTPPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <InputOTPPrimitive.Separator
    ref={ref}
    className={cn("mx-2 flex items-center justify-center", className)}
    {...props}
  />
));
InputOTPSeparator.displayName = InputOTPPrimitive.Separator.displayName;

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
