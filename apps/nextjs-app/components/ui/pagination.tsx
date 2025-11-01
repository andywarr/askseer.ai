import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/apps/nextjs-app/lib/utils";

export type PaginationProps = React.ComponentProps<"nav">;

export function Pagination({ className, ...props }: PaginationProps) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

export type PaginationContentProps = React.ComponentProps<"ul">;

export function PaginationContent({
  className,
  ...props
}: PaginationContentProps) {
  return (
    <ul
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

export type PaginationItemProps = React.ComponentProps<"li">;

export function PaginationItem({ className, ...props }: PaginationItemProps) {
  return <li className={cn(className)} {...props} />;
}

export type PaginationLinkProps = React.ComponentProps<"a"> & {
  isActive?: boolean;
};

export function PaginationLink({
  className,
  isActive,
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "border-input bg-background hover:bg-accent hover:text-accent-foreground flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium shadow-sm transition-colors",
        isActive && "bg-accent text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export type PaginationPreviousProps = React.ComponentProps<
  typeof PaginationLink
>;

export function PaginationPrevious({
  className,
  ...props
}: PaginationPreviousProps) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      className={cn("flex items-center gap-1 px-3", className)}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="sr-only">Previous</span>
    </PaginationLink>
  );
}

export type PaginationNextProps = React.ComponentProps<typeof PaginationLink>;

export function PaginationNext({ className, ...props }: PaginationNextProps) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      className={cn("flex items-center gap-1 px-3", className)}
      {...props}
    >
      <ChevronRight className="h-4 w-4" />
      <span className="sr-only">Next</span>
    </PaginationLink>
  );
}

export type PaginationEllipsisProps = React.ComponentProps<"span">;

export function PaginationEllipsis({
  className,
  ...props
}: PaginationEllipsisProps) {
  return (
    <span
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      &hellip;
    </span>
  );
}
