import * as React from "react";

import { cn } from "@/apps/nextjs-app/lib/utils";

const Textarea = (
  {
    ref,
    className,
    ...props
  }: React.ComponentProps<"textarea"> & {
    ref: React.RefObject<HTMLTextAreaElement>;
  }
) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-zinc-500 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};
Textarea.displayName = "Textarea";

export { Textarea };
