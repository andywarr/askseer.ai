import * as React from "react";

import { cn } from "@/apps/nextjs-app/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-zinc-500 focus-visible:border-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:outline aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-red-500/20 md:text-sm dark:border-zinc-800 dark:bg-zinc-200/30 dark:dark:bg-zinc-800/30 dark:placeholder:text-zinc-400 dark:focus-visible:border-zinc-300 dark:focus-visible:outline dark:focus-visible:outline-zinc-300/50 dark:aria-invalid:border-red-900 dark:aria-invalid:outline dark:aria-invalid:outline-red-500/40 dark:aria-invalid:outline-red-900/20 dark:dark:aria-invalid:outline-red-900/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
