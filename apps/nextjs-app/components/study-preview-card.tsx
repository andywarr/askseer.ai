import Image from "next/image";
import { StudyStatus, StudyType } from "@prisma/client";

import { Card, CardContent, CardFooter, CardHeader } from "@/apps/nextjs-app/components/ui/card";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import { StudyButton } from "@/apps/nextjs-app/components/study-button";
import { cn } from "@/apps/nextjs-app/lib/utils";
import { getStudyTypeLabel } from "@/apps/nextjs-app/lib/studies";

type StudyPreview = {
  id: string;
  name?: string | null;
  type: StudyType;
  status: StudyStatus;
  createdByUserId: string;
};

type StudyPreviewCardProps = {
  study: StudyPreview;
  currentUserId: string;
  previewUrl?: string | null;
  className?: string;
  headerClassName?: string;
  imagePriority?: boolean;
};

export function StudyPreviewCard({
  study,
  currentUserId,
  previewUrl,
  className,
  headerClassName,
  imagePriority = false,
}: StudyPreviewCardProps) {
  const canManage = study.createdByUserId === currentUserId;
  const typeLabel = getStudyTypeLabel(study.type);

  return (
    <Card className={cn("w-full gap-3 overflow-hidden pt-0 pb-6", className)}>
      <CardHeader className={cn("relative h-56", headerClassName)}>
        {previewUrl ? (
          <Image
            className="object-cover"
            src={previewUrl}
            fill
            alt={study.name ? `Preview of ${study.name}` : "Preview of study"}
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
            <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
              {typeLabel}
            </small>
            <h3 className="scroll-m-20 text-xl font-semibold tracking-tight">
              {study.name ?? "Untitled"}
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
          canManage={canManage}
        />
      </CardFooter>
    </Card>
  );
}
