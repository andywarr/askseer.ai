"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import MoreMenu from "@/apps/nextjs-app/components/study-details-more-menu";
import { MenuSurface } from "@/apps/nextjs-app/lib/constants";
import { setPersonaCompanyVisibility } from "@/apps/nextjs-app/lib/action";

interface PersonaMoreMenuProps {
  study: any;
  userId: string;
  photoKey?: string;
  coverKey?: string;
  hasAssociatedStudies: boolean;
  isOwner: boolean;
  isCompanyVisible: boolean;
  canManageCompanyVisibility: boolean;
}

export function PersonaMoreMenu({
  study,
  userId,
  photoKey,
  coverKey,
  hasAssociatedStudies,
  isOwner,
  isCompanyVisible,
  canManageCompanyVisibility,
}: PersonaMoreMenuProps) {
  const router = useRouter();
  const [companyVisible, setCompanyVisible] = useState(isCompanyVisible);
  const [isTogglingVisibility, startToggleTransition] = useTransition();

  useEffect(() => {
    setCompanyVisible(isCompanyVisible);
  }, [isCompanyVisible]);

  const handleCompanyVisibilityToggle = (nextVisible: boolean) => {
    if (!canManageCompanyVisibility) {
      return;
    }

    startToggleTransition(() => {
      setPersonaCompanyVisibility(study.id, nextVisible)
        .then((result) => {
          const updated = Boolean(result?.availableToCompany ?? nextVisible);
          setCompanyVisible(updated);
          toast.success(
            updated
              ? "Persona is now available to everyone at your company."
              : "Persona is no longer shared with your company.",
          );
          router.refresh();
        })
        .catch((error) => {
          console.error("Failed to update persona company visibility", error);
          toast.error("Failed to update company visibility. Please try again.");
        });
    });
  };

  return (
    <MoreMenu
      surface={MenuSurface.PERSONA}
      userId={userId}
      study={study}
      s3Keys={[coverKey, photoKey].filter(Boolean) as string[]}
      canDelete={isOwner}
      canEdit={isOwner}
      onEdit={() => router.push(`/persona/${study.id}/edit`)}
      canToggleCompanyVisibility={canManageCompanyVisibility}
      isCompanyVisible={companyVisible}
      isTogglingCompanyVisibility={isTogglingVisibility}
      onToggleCompanyVisibility={handleCompanyVisibilityToggle}
    />
  );
}
