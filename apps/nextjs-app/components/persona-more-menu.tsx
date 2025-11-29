"use client";

import { useRouter } from "next/navigation";
import MoreMenu from "@/apps/nextjs-app/components/study-details-more-menu";
import { MenuSurface } from "@/apps/nextjs-app/lib/constants";

interface PersonaMoreMenuProps {
  study: any;
  userId: string;
  photoKey?: string;
  coverKey?: string;
  hasAssociatedStudies: boolean;
  canManage: boolean;
}

export function PersonaMoreMenu({
  study,
  userId,
  photoKey,
  coverKey,
  hasAssociatedStudies,
  canManage,
}: PersonaMoreMenuProps) {
  const router = useRouter();

  // Prevent deletion if persona has associated studies (heuristic evaluations or cognitive walkthroughs)
  const canDelete = canManage && !hasAssociatedStudies;

  return (
    <MoreMenu
      surface={MenuSurface.PERSONA}
      userId={userId}
      study={study}
      s3Keys={[coverKey, photoKey].filter(Boolean) as string[]}
      canDelete={canDelete}
      canEdit={canManage}
      onEdit={() => router.push(`/persona/${study.id}/edit`)}
      deleteDisabledReason={
        hasAssociatedStudies
          ? "Cannot delete persona with related studies"
          : undefined
      }
    />
  );
}
