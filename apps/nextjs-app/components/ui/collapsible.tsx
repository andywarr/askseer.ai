"use client";

import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cn } from "@/apps/nextjs-app/lib/utils";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = (
  {
    ref,
    className,
    children,
    ...props
  }: React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent> & {
    ref: React.RefObject<React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>>;
  }
) => (<CollapsiblePrimitive.CollapsibleContent
  ref={ref}
  className={cn(
    "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden text-sm",
    className,
  )}
  {...props}
>
  <div className="pb-4 pt-0">{children}</div>
</CollapsiblePrimitive.CollapsibleContent>);
CollapsibleContent.displayName =
  CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
