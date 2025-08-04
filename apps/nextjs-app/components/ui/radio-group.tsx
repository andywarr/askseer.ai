"use client";

import * as React from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "@/apps/nextjs-app/lib/utils";

const RadioGroup = (
  {
    ref,
    className,
    ...props
  }: React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & {
    ref: React.RefObject<React.ElementRef<typeof RadioGroupPrimitive.Root>>;
  }
) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
};
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = (
  {
    ref,
    className,
    ...props
  }: React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    ref: React.RefObject<React.ElementRef<typeof RadioGroupPrimitive.Item>>;
  }
) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-zinc-200 border-zinc-900 text-zinc-900 shadow-sm focus:outline-hidden focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-50 dark:border-zinc-800 dark:text-zinc-50 dark:focus-visible:ring-zinc-300",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <CheckIcon className="fill-primary h-3.5 w-3.5" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
};
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
