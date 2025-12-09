"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { cn } from "@/apps/nextjs-app/lib/utils";
import { toggleStudyStar } from "@/apps/nextjs-app/lib/data";

interface StarStudyButtonProps {
  studyId: string;
  userId: string;
  isStarred: boolean;
  variant?: "icon" | "menuItem";
  className?: string;
  onToggle?: (isStarred: boolean) => void;
}

export function StarStudyButton({
  studyId,
  userId,
  isStarred: initialStarred,
  variant = "icon",
  className,
  onToggle,
}: StarStudyButtonProps) {
  const [isStarred, setIsStarred] = useState(initialStarred);
  const [isPending, startTransition] = useTransition();

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    startTransition(async () => {
      const result = await toggleStudyStar(userId, studyId);
      if (result.success) {
        setIsStarred(result.isStarred);
        onToggle?.(result.isStarred);
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
        <Star
          className={cn(
            "h-4 w-4",
            isStarred ? "fill-yellow-400 text-yellow-400" : "text-zinc-500",
          )}
        />
        {isStarred ? "Unstar" : "Star"}
      </button>
    );
  }

  return (
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
      <Star
        className={cn(
          "h-4 w-4",
          isStarred
            ? "fill-yellow-400 text-yellow-400"
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
        )}
      />
      <span className="sr-only">{isStarred ? "Unstar" : "Star"} study</span>
    </Button>
  );
}
