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

  return (
    <MoreMenu
      surface={MenuSurface.PERSONA}
      userId={userId}
      study={study}
      s3Keys={[coverKey, photoKey].filter(Boolean) as string[]}
      canDelete={canManage}
      canEdit={canManage}
      onEdit={() => router.push(`/persona/${study.id}/edit`)}
    />
  );
}
