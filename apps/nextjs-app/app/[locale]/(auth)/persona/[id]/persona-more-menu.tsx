"use client";

import { useRouter } from "next/navigation";
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { useTranslations } from "next-intl";
import { MenuSurface } from "@/apps/nextjs-app/lib/utils/constants";
import type { StudyVisibility } from "@/apps/nextjs-app/types/types";

/**
 * Study type for PersonaMoreMenu - matches the properties used by MoreMenu component.
 */
type PersonaStudy = {
  id: string;
  files?: Array<{ key?: string | null }>;
  visibility?: StudyVisibility;
  shareToken?: string | null;
};

interface PersonaMoreMenuProps {
  study: PersonaStudy;
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
  const t = useTranslations("PersonaDetail");

  // Prevent deletion if persona has associated studies (heuristic evaluations or cognitive walkthroughs)
  const canDelete = canManage && !hasAssociatedStudies;

  // Determine the reason why delete is disabled
  const getDeleteDisabledReason = () => {
    if (!canManage) {
      return t("deleteOnlyOwner");
    }
    if (hasAssociatedStudies) {
      return t("deleteHasAssociatedStudies");
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
        !canManage ? t("editOnlyOwner") : undefined
      }
      shareDisabledReason={
        !canManage ? t("shareOnlyOwner") : undefined
      }
      isBookmarked={isBookmarked}
      hasCompany={hasCompany}
      isPersonalTeam={isPersonalTeam}
    />
  );
}
