"use client";

// React imports
import { useState, useEffect, useRef } from "react";

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

// Lib imports
import { cn } from "@/apps/nextjs-app/lib/utils";
import { getStudyTypeLabel } from "@/apps/nextjs-app/lib/study";
import { retryStudy } from "@/apps/nextjs-app/lib/action";
import { deleteStudy, getStudyStatus } from "@/apps/nextjs-app/lib/data";
import { deleteS3Objects } from "@/apps/nextjs-app/lib/action";

// Prisma imports
import { StudyStatus, StudyType } from "@prisma/client";

// Other imports
import {
  MoreVertical,
  ExternalLink,
  Trash2,
  RotateCcw,
  Loader2,
} from "lucide-react";

type StudyUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type StudyFile = {
  key?: string | null;
} | null;

type StudySummary = {
  id: string;
  name: string | null;
  status: StudyStatus;
  type: StudyType;
  createdByUserId: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdByUser?: StudyUser | null;
  lastModifiedByUser?: StudyUser | null;
  files?: (StudyFile | null)[] | null;
};

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
};

function getStudyHref(type: StudyType, id: string): string | null {
  switch (type) {
    case StudyType.HEURISTIC_EVALUATION:
      return `/evaluation/${id}`;
    case StudyType.PERSONA:
      return `/persona/${id}`;
    case StudyType.COGNITIVE_WALKTHROUGH:
      return `/walkthrough/${id}`;
    default:
      return null;
  }
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function StudyCard({
  study,
  currentUserId,
  previewUrl,
  canManage,
  canView,
  className,
  imageClassName,
  imagePriority,
  personaVersion,
}: StudyCardProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<StudyStatus>(study.status);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const managePermission =
    typeof canManage === "boolean"
      ? canManage
      : study.createdByUserId === currentUserId;

  const viewPermission = canView ?? true;

  const isPending = currentStatus === StudyStatus.PENDING;
  const isFailed = currentStatus === StudyStatus.FAILED;
  const isCompleted = currentStatus === StudyStatus.COMPLETED;

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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

  function handleOpen() {
    if (href && isCompleted && viewPermission) {
      router.push(href);
    }
  }

  function handleCardClick() {
    if (isCompleted && viewPermission && href) {
      router.push(href);
    }
  }

  const isClickable = isCompleted && viewPermission && href;

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
      {/* More Menu - Top Right */}
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer hover:bg-white/70 dark:hover:bg-zinc-900/70"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
            {managePermission && (
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardHeader className={cn("relative h-56", imageClassName)}>
        {previewUrl ? (
          <Image
            className="object-cover"
            src={previewUrl}
            fill
            alt={`Preview of ${study.name || "study"}`}
            priority={imagePriority}
            unoptimized
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
              {study.type === StudyType.PERSONA
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
}
