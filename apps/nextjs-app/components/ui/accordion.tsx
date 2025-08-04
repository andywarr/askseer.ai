"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "@/apps/nextjs-app/lib/utils";
import { ChevronDownIcon } from "@radix-ui/react-icons";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = (
  {
    ref,
    className,
    ...props
  }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> & {
    ref: React.RefObject<React.ElementRef<typeof AccordionPrimitive.Item>>;
  }
) => (<AccordionPrimitive.Item
  ref={ref}
  className={cn("border-b", className)}
  {...props}
/>);
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = (
  {
    ref,
    className,
    children,
    ...props
  }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    ref: React.RefObject<React.ElementRef<typeof AccordionPrimitive.Trigger>>;
  }
) => (<AccordionPrimitive.Header className="flex">
  <AccordionPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex flex-1 items-center justify-between py-4 text-left text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronDownIcon className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400" />
  </AccordionPrimitive.Trigger>
</AccordionPrimitive.Header>);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = (
  {
    ref,
    className,
    children,
    ...props
  }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
    ref: React.RefObject<React.ElementRef<typeof AccordionPrimitive.Content>>;
  }
) => (<AccordionPrimitive.Content
  ref={ref}
  className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm"
  {...props}
>
  <div className={cn("pb-4 pt-0", className)}>{children}</div>
</AccordionPrimitive.Content>);
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
