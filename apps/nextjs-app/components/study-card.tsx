// Next imports
import Image from "next/image";

// UI component imports
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/apps/nextjs-app/components/ui/card";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";

// Custom component imports
import { StudyButton } from "@/apps/nextjs-app/components/study-button";

// Lib imports
import { cn } from "@/apps/nextjs-app/lib/utils";
import { getStudyTypeLabel } from "@/apps/nextjs-app/lib/study";

// Prisma imports
import { StudyStatus, StudyType } from "@prisma/client";

type StudySummary = {
  id: string;
  name: string | null;
  status: StudyStatus;
  type: StudyType;
  createdByUserId: string;
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
  const managePermission =
    typeof canManage === "boolean"
      ? canManage
      : study.createdByUserId === currentUserId;

  return (
    <Card className={cn("w-full gap-3 overflow-hidden pt-0 pb-6", className)}>
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
            <h3 className="scroll-m-20 text-xl font-semibold tracking-tight">
              {study.name || "Untitled"}
            </h3>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <StudyButton
          id={study.id}
          status={study.status}
          type={study.type}
          userId={currentUserId}
          canManage={managePermission}
          canView={canView}
        />
      </CardFooter>
    </Card>
  );
}
