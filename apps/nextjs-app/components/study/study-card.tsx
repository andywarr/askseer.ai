"use client";

// React imports
import { useState, useEffect, useRef, memo } from "react";

// Next imports
import Image from "next/image";
import { useRouter } from "next/navigation";

// UI component imports
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/apps/nextjs-app/components/ui/card";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";

// Lib imports
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import { getStudyTypeLabel } from "@/apps/nextjs-app/lib/db/study";
import { retryStudy } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { deleteStudy, getStudyStatus } from "@/apps/nextjs-app/lib/db/data";
import { deleteS3Objects } from "@/apps/nextjs-app/lib/actions/s3-actions";
import {
  type StudySummary,
  getStudyHref,
  formatDate,
} from "@/apps/nextjs-app/lib/utils/study-helpers";

// Prisma imports
import { StudyStatus, StudyType } from "@prisma/client";

// Other imports
import {
  MoreVertical,
  ExternalLink,
  Trash2,
  RotateCcw,
  Loader2,
  Share,
} from "lucide-react";

// Star study component
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";

type StudyCardProps = {
  study: StudySummary;
  currentUserId: string;
  previewUrl?: string | null;
  canManage?: boolean;
  canView?: boolean;
  className?: string;
  imageClassName?: string;
  imagePriority?: boolean;
  personaVersion?: number;
  isBookmarked?: boolean;
  hasAssociatedStudies?: boolean;
};

export const StudyCard = memo(function StudyCard({
  study,
  currentUserId,
  previewUrl,
  canManage,
  canView,
  className,
  imageClassName,
  imagePriority,
  personaVersion,
  isBookmarked = false,
  hasAssociatedStudies = false,
}: StudyCardProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<StudyStatus>(study.status);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const managePermission =
    typeof canManage === "boolean"
      ? canManage
      : study.createdByUserId === currentUserId;

  const viewPermission = canView ?? true;

  const isPending = currentStatus === StudyStatus.PENDING;
  const isFailed = currentStatus === StudyStatus.FAILED;
  const isCompleted = currentStatus === StudyStatus.COMPLETED;
  const supportsShare =
    isCompleted &&
    study.type !== StudyType.LIVE_SESSION &&
    study.type !== StudyType.INTERVIEW;

  const href = getStudyHref(study.type, study.id);

  // Determine which user to display - prefer lastModifiedByUser if available, otherwise createdByUser
  const displayUser = study.lastModifiedByUser || study.createdByUser;
  const displayDate = study.updatedAt || study.createdAt;

  // Polling effect for pending studies
  useEffect(() => {
    if (isPending && managePermission) {
      const pollStatus = async () => {
        try {
          const { status } = await getStudyStatus(study.id, currentUserId);
          setCurrentStatus(status);

          // When the study completes, stop polling and refresh the current route
          if (
            status === StudyStatus.COMPLETED ||
            status === StudyStatus.FAILED
          ) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            router.refresh();
          }
        } catch (error) {
          console.error("Failed to poll study status:", error);
        }
      };

      // Start polling every 15 seconds
      // Run an immediate poll first to pick up fresh state
      pollStatus();
      intervalRef.current = setInterval(pollStatus, 15000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [managePermission, isPending, study.id, currentUserId, router]);

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation();
    if (!managePermission || isRetrying) return;

    setIsRetrying(true);
    try {
      const res = await retryStudy(study.id);
      if (res?.success) {
        setCurrentStatus(StudyStatus.PENDING);
      } else {
        setCurrentStatus(StudyStatus.FAILED);
      }
    } catch (error) {
      console.error("Retry failed", error);
      setCurrentStatus(StudyStatus.FAILED);
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleDelete() {
    if (!managePermission || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteStudy(study.id, currentUserId);

      // Delete S3 files if any
      const fileKeys =
        study.files
          ?.map((file) => file?.key)
          .filter((key): key is string => !!key) || [];
      if (fileKeys.length > 0) {
        await deleteS3Objects(fileKeys);
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to delete study:", error);
    } finally {
      setIsDeleting(false);
    }
  }

  // Interview studies are navigable even while pending (management page shows sessions)
  const isNavigable =
    (isCompleted ||
      (study.type === StudyType.INTERVIEW && !isFailed)) &&
    viewPermission &&
    !!href;

  function handleOpen() {
    if (isNavigable) {
      router.push(href!);
    }
  }

  function handleCardClick() {
    if (isNavigable) {
      router.push(href!);
    }
  }

  const isClickable = isNavigable;

  return (
    <Card
      className={cn(
        "relative w-full gap-3 overflow-hidden pt-0 pb-4",
        isClickable &&
          "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600",
        className,
      )}
      onClick={handleCardClick}
    >
      {/* Star and More Menu - Top Right */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <BookmarkStudyButton
          studyId={study.id}
          userId={currentUserId}
          isBookmarked={isBookmarked}
          className="hover:bg-white/70 dark:hover:bg-zinc-900/70"
        />
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer hover:bg-white/70 dark:hover:bg-zinc-900/70"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <BookmarkStudyButton
              studyId={study.id}
              userId={currentUserId}
              isBookmarked={isBookmarked}
              variant="menuItem"
            />
            {supportsShare && managePermission && (
              <div onClick={(e) => e.stopPropagation()}>
                <ShareStudyButton
                  studyId={study.id}
                  visibility={study.visibility || "TEAM"}
                  shareToken={study.shareToken || null}
                  hasCompany={!!study.team?.company}
                  isPersonalTeam={study.team?.isPersonal}
                  variant="menuItem"
                  onClose={() => setMenuOpen(false)}
                />
              </div>
            )}
            {supportsShare && !managePermission && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <DropdownMenuItem disabled={true}>
                      <Share className="mr-2 h-4 w-4 text-zinc-400" />
                      <span className="text-zinc-400">Share</span>
                    </DropdownMenuItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Only the owner can share this study</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isCompleted && viewPermission && (
              <DropdownMenuItem onClick={handleOpen}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </DropdownMenuItem>
            )}
            {isFailed && managePermission && (
              <DropdownMenuItem onClick={handleRetry} disabled={isRetrying}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry
              </DropdownMenuItem>
            )}
            {managePermission && !hasAssociatedStudies && (
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
            {managePermission && hasAssociatedStudies && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <DropdownMenuItem disabled={true}>
                      <Trash2 className="mr-2 h-4 w-4 text-zinc-400" />
                      <span className="text-zinc-400">Delete</span>
                    </DropdownMenuItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Cannot delete persona with related studies</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!managePermission && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <DropdownMenuItem disabled={true}>
                      <Trash2 className="mr-2 h-4 w-4 text-zinc-400" />
                      <span className="text-zinc-400">Delete</span>
                    </DropdownMenuItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Only the owner can delete this study</p>
                </TooltipContent>
              </Tooltip>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardHeader className={cn("relative h-56", imageClassName)}>
        {previewUrl &&
        typeof previewUrl === "string" &&
        previewUrl.trim() !== "" ? (
          <Image
            className="object-cover"
            src={previewUrl}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            alt={`Preview of ${study.name || "study"}`}
            priority={imagePriority}
          />
        ) : (
          <Skeleton className="absolute inset-0" />
        )}
      </CardHeader>
      <CardContent>
        <div className="mt-4 flex flex-col gap-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
                {getStudyTypeLabel(study.type)}
              </small>
              {personaVersion !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  Version {personaVersion}
                </Badge>
              )}
            </div>
            <h3 className="line-clamp-2 scroll-m-20 text-xl font-semibold tracking-tight">
              {study.name || "Untitled"}
            </h3>
          </div>
        </div>
      </CardContent>
      <CardFooter className="h-10 items-end pt-0">
        {isPending ? (
          // Processing indicator
          <div className="flex w-full items-center gap-2 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">
              {study.type === StudyType.PERSONA ||
              study.type === StudyType.LIVE_SESSION ||
              study.type === StudyType.INTERVIEW
                ? "Creating..."
                : "Analyzing..."}
            </span>
          </div>
        ) : isFailed ? (
          // Failed state with retry button and error message
          <div className="flex w-full items-center gap-3">
            {managePermission && (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1 h-3 w-3" />
                )}
                Retry
              </Button>
            )}
            <span className="text-xs text-red-500">
              Something went wrong. Your credit has been refunded. Select
              &apos;Retry&apos; to try again for free.
            </span>
          </div>
        ) : (
          // Completed state - show user and date
          <div className="flex w-full items-center justify-between text-xs text-zinc-500">
            <span className="truncate">
              {displayUser?.name || displayUser?.email || "Unknown"}
            </span>
            <span className="shrink-0">{formatDate(displayDate)}</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
});
