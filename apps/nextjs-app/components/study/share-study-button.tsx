"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { ShareStudyDialog } from "@/apps/nextjs-app/components/study/share-study-dialog";
import {
  handleUpdateStudyVisibility,
  handleRegenerateShareToken,
  handleToggleShareLink,
} from "@/apps/nextjs-app/lib/actions/study-actions";
import { cn } from "@/apps/nextjs-app/lib/utils";
import type { StudyVisibility } from "@/apps/nextjs-app/types/types";

interface ShareStudyButtonProps {
  studyId: string;
  visibility: StudyVisibility;
  shareToken: string | null;
  hasCompany?: boolean;
  className?: string;
  variant?: "icon" | "menuItem";
}

export function ShareStudyButton({
  studyId,
  visibility,
  shareToken,
  hasCompany = false,
  className,
  variant = "icon",
}: ShareStudyButtonProps) {
  const [open, setOpen] = useState(false);

  const handleVisibilityChange = async (
    newVisibility: StudyVisibility,
  ): Promise<{ success: boolean; shareToken?: string }> => {
    const result = await handleUpdateStudyVisibility(studyId, newVisibility);
    if (result.success) {
      return { success: true, shareToken: result.shareToken ?? undefined };
    }
    return { success: false };
  };

  const handleRegenerateToken = async (): Promise<{
    success: boolean;
    shareToken?: string;
  }> => {
    const result = await handleRegenerateShareToken(studyId);
    if (result.success && result.shareToken) {
      return { success: true, shareToken: result.shareToken };
    }
    return { success: false };
  };

  const handleToggleLink = async (
    enabled: boolean,
  ): Promise<{ success: boolean; shareToken?: string }> => {
    const result = await handleToggleShareLink(studyId, enabled);
    if (result.success) {
      return { success: true, shareToken: result.shareToken };
    }
    return { success: false };
  };

  if (variant === "menuItem") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sm",
            "rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800",
            className,
          )}
        >
          <Share2 className="mr-2 h-4 w-4 text-zinc-500" />
          Share
        </button>
        <ShareStudyDialog
          studyId={studyId}
          userId=""
          currentVisibility={visibility}
          shareToken={shareToken}
          hasCompany={hasCompany}
          onVisibilityChange={handleVisibilityChange}
          onRegenerateToken={handleRegenerateToken}
          onToggleShareLink={handleToggleLink}
          open={open}
          onOpenChange={setOpen}
        />
      </>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 cursor-pointer", className)}
            onClick={() => setOpen(true)}
          >
            <Share2 className="h-4 w-4 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Share</p>
        </TooltipContent>
      </Tooltip>
      <ShareStudyDialog
        studyId={studyId}
        userId=""
        currentVisibility={visibility}
        shareToken={shareToken}
        hasCompany={hasCompany}
        onVisibilityChange={handleVisibilityChange}
        onRegenerateToken={handleRegenerateToken}
        onToggleShareLink={handleToggleLink}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
