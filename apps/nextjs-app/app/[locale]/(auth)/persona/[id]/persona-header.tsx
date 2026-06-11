import Image from "next/image";
import type { ReactNode } from "react";
import { getInitials } from "./persona-utils";
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";
import { PersonaMoreMenu } from "./persona-more-menu";
import type { PersonaStudy } from "./persona-types";
import type { StudyVisibility } from "@/apps/nextjs-app/types/types";
import { GlobalTranslateButton } from "@/apps/nextjs-app/components/i18n/global-translate-button";

interface PersonaHeaderProps {
  name: string | undefined;
  coverUrl: string | null;
  photoUrl: string | null;
  study: PersonaStudy;
  userId: string;
  isBookmarked: boolean;
  shareInfo: {
    visibility: StudyVisibility;
    shareToken: string | null;
  } | null;
  hasCompany: boolean;
  isPersonalTeam: boolean;
  photoKey: string | undefined;
  coverKey: string | undefined;
  hasAssociatedStudies: boolean;
  canManage: boolean;
  chatTrigger?: ReactNode;
  studyLocale: string;
}

/**
 * PersonaHeader component - displays cover image/gradient with avatar overlay
 * and action buttons (bookmark, share, more menu).
 */
export function PersonaHeader({
  name,
  coverUrl,
  photoUrl,
  study,
  userId,
  isBookmarked,
  shareInfo,
  hasCompany,
  isPersonalTeam,
  photoKey,
  coverKey,
  hasAssociatedStudies,
  canManage,
  chatTrigger,
  studyLocale,
}: PersonaHeaderProps) {
  // Reusable avatar overlay (half over cover, half below)
  const avatarOverlay = (
    <div className="pointer-events-none absolute top-full left-6 z-10 -translate-y-1/2 md:left-8">
      <div className="pointer-events-auto h-28 w-28 overflow-hidden rounded-2xl shadow ring-2 ring-white md:h-32 md:w-32 dark:ring-zinc-900">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name ? `${name} profile photo` : "Persona profile photo"}
            width={256}
            height={256}
            className="h-full w-full object-cover"
            sizes="(max-width: 768px) 7rem, 8rem"
            priority
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 text-zinc-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200">
            <span className="text-xl font-semibold">{getInitials(name)}</span>
          </div>
        )}
      </div>
    </div>
  );

  // Action buttons (bookmark, share, more menu)
  const actionButtons = (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-1 print:hidden">
      {chatTrigger}
      <GlobalTranslateButton studyLocale={studyLocale} />
      <BookmarkStudyButton
        studyId={study.id}
        userId={userId}
        isBookmarked={isBookmarked}
      />
      {shareInfo && (
        <ShareStudyButton
          studyId={study.id}
          visibility={shareInfo.visibility}
          shareToken={shareInfo.shareToken}
          hasCompany={hasCompany}
          isPersonalTeam={isPersonalTeam}
        />
      )}
      <PersonaMoreMenu
        study={study}
        userId={userId}
        photoKey={photoKey}
        coverKey={coverKey}
        hasAssociatedStudies={hasAssociatedStudies}
        canManage={canManage}
        isBookmarked={isBookmarked}
        hasCompany={hasCompany}
        isPersonalTeam={isPersonalTeam}
      />
    </div>
  );

  if (coverUrl) {
    return (
      <div className="relative mb-14 h-[25svh] w-full md:mb-16 md:h-[25vh]">
        {actionButtons}
        <Image
          src={coverUrl}
          alt={name ? `${name} cover` : "Persona cover image"}
          fill
          className="rounded-2xl object-cover"
          priority
          sizes="100vw"
          unoptimized
        />
        {avatarOverlay}
      </div>
    );
  }

  return (
    <div className="relative mb-14 h-[25svh] w-full rounded-2xl bg-gradient-to-r from-zinc-100 to-zinc-200 md:mb-16 md:h-[25vh] dark:from-zinc-800 dark:to-zinc-900">
      {actionButtons}
      {avatarOverlay}
    </div>
  );
}
