"use client";

import { useRouter } from "next/navigation";
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { MenuSurface } from "@/apps/nextjs-app/lib/utils/constants";

interface PersonaMoreMenuProps {
  study: any;
  userId: string;
  photoKey?: string;
  coverKey?: string;
  hasAssociatedStudies: boolean;
  canManage: boolean;
  isBookmarked?: boolean;
  hasCompany?: boolean;
  isPersonalTeam?: boolean;
}

export function PersonaMoreMenu({
  study,
  userId,
  photoKey,
  coverKey,
  hasAssociatedStudies,
  canManage,
  isBookmarked = false,
  hasCompany = false,
  isPersonalTeam = false,
}: PersonaMoreMenuProps) {
  const router = useRouter();

  // Prevent deletion if persona has associated studies (heuristic evaluations or cognitive walkthroughs)
  const canDelete = canManage && !hasAssociatedStudies;

  // Determine the reason why delete is disabled
  const getDeleteDisabledReason = () => {
    if (!canManage) {
      return "Only the owner can delete this persona";
    }
    if (hasAssociatedStudies) {
      return "Cannot delete persona with related studies";
    }
    return undefined;
  };

  return (
    <MoreMenu
      surface={MenuSurface.PERSONA}
      userId={userId}
      study={study}
      s3Keys={[coverKey, photoKey].filter(Boolean) as string[]}
      canDelete={canDelete}
      canEdit={canManage}
      canShare={canManage}
      onEdit={() => router.push(`/persona/${study.id}/edit`)}
      deleteDisabledReason={getDeleteDisabledReason()}
      editDisabledReason={
        !canManage ? "Only the owner can edit this persona" : undefined
      }
      shareDisabledReason={
        !canManage ? "Only the owner can share this persona" : undefined
      }
      isBookmarked={isBookmarked}
      hasCompany={hasCompany}
      isPersonalTeam={isPersonalTeam}
    />
  );
}
