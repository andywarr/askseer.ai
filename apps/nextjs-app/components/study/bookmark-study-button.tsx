"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { cn } from "@/apps/nextjs-app/lib/utils";
import { toggleStudyBookmark } from "@/apps/nextjs-app/lib/data";

interface BookmarkStudyButtonProps {
  studyId: string;
  userId: string;
  isBookmarked: boolean;
  variant?: "icon" | "menuItem";
  className?: string;
  onToggle?: (isBookmarked: boolean) => void;
}

export function BookmarkStudyButton({
  studyId,
  userId,
  isBookmarked: initialBookmarked,
  variant = "icon",
  className,
  onToggle,
}: BookmarkStudyButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    startTransition(async () => {
      const result = await toggleStudyBookmark(userId, studyId);
      if (result.success) {
        setIsBookmarked(result.isBookmarked);
        onToggle?.(result.isBookmarked);
      }
    });
  };

  if (variant === "menuItem") {
    return (
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sm",
          "rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800",
          isPending && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <Bookmark
          className={cn(
            "mr-2 h-4 w-4",
            isBookmarked ? "fill-amber-500 text-amber-500" : "text-zinc-500",
          )}
        />
        {isBookmarked ? "Remove bookmark" : "Bookmark"}
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 cursor-pointer",
            isPending && "cursor-not-allowed opacity-50",
            className,
          )}
          onClick={handleToggle}
          disabled={isPending}
        >
          <Bookmark
            className={cn(
              "h-4 w-4",
              isBookmarked
                ? "fill-amber-500 text-amber-500"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
            )}
          />
          <span className="sr-only">{isBookmarked ? "Remove bookmark" : "Bookmark"} study</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isBookmarked ? "Remove bookmark" : "Bookmark"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
