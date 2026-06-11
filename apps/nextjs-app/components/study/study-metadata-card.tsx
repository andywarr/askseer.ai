import Gallery from "@/apps/nextjs-app/components/study/gallery";
import { PersonaDisplay } from "@/apps/nextjs-app/components/persona/persona-display";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/study/user-metadata";
import type { DisplayUser } from "@/apps/nextjs-app/lib/utils/study-helpers";
import { useTranslations } from "next-intl";

export type { DisplayUser };

export interface PersonaData {
  photoUrl: string | null;
  name: string | null;
  description: string | null;
  hasAccess: boolean;
}

interface StudyMetadataCardProps {
  goal: string;
  user: string | null;
  context: string | null;
  presignedUrls: string[];
  linkedPersona: { studyId: string } | null | undefined;
  personaData: PersonaData;
  createdByDisplayUser: DisplayUser | null;
  lastModifiedByDisplayUser: DisplayUser | null;
  createdAtFormatted: string;
  updatedAtFormatted: string;
  /** Additional metadata fields to display in the top grid (e.g., heuristic family) */
  extraFields?: React.ReactNode;
}

export function StudyMetadataCard({
  goal,
  user,
  context,
  presignedUrls,
  linkedPersona,
  personaData,
  createdByDisplayUser,
  lastModifiedByDisplayUser,
  createdAtFormatted,
  updatedAtFormatted,
  extraFields,
}: StudyMetadataCardProps) {
  const t = useTranslations("StudyMetadata");

  return (
    <div className="mb-8 min-w-0 overflow-hidden rounded-lg bg-gray-100 p-6 text-sm">
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="leading-5 font-semibold tracking-tight">{t("userGoal")}</p>
          <p className="leading-5">{goal}</p>
        </div>

        <div>
          <p className="leading-5 font-semibold tracking-tight">{t("targetUser")}</p>
          {linkedPersona ? (
            <PersonaDisplay
              personaStudyId={linkedPersona.studyId}
              name={personaData.name}
              description={personaData.description}
              photoUrl={personaData.photoUrl}
              hasAccess={personaData.hasAccess}
            />
          ) : (
            <p className="leading-5">{user ? user : t("notDefined")}</p>
          )}
        </div>

        {extraFields}

        {context && (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="leading-5 font-semibold tracking-tight">
              {t("additionalContext")}
            </p>
            <p className="leading-5">{context}</p>
          </div>
        )}
      </div>

      <div className="print:hidden">
        <Gallery presignedUrls={presignedUrls} />
      </div>
      <div className="mt-6 grid gap-4 text-sm text-zinc-600 sm:grid-cols-4">
        <div>
          <p className="font-semibold text-zinc-700">{t("createdBy")}</p>
          <UserMetadataDisplay user={createdByDisplayUser} className="mt-1" />
        </div>
        <div>
          <p className="font-semibold text-zinc-700">{t("createdOn")}</p>
          <p>{createdAtFormatted}</p>
        </div>
        <div>
          <p className="font-semibold text-zinc-700">{t("modifiedBy")}</p>
          <UserMetadataDisplay
            user={lastModifiedByDisplayUser}
            className="mt-1"
          />
        </div>
        <div>
          <p className="font-semibold text-zinc-700">{t("lastModified")}</p>
          <p>{updatedAtFormatted}</p>
        </div>
      </div>
    </div>
  );
}
