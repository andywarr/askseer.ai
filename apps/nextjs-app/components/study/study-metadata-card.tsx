import Gallery from "@/apps/nextjs-app/components/study/gallery";
import { PersonaDisplay } from "@/apps/nextjs-app/components/persona/persona-display";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/study/user-metadata";

export interface PersonaData {
  photoUrl: string | null;
  name: string | null;
  description: string | null;
  hasAccess: boolean;
}

export interface DisplayUser {
  name: string | null;
  email: string | undefined;
  image: string | null;
  status: string | null;
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
  return (
    <div className="mb-8 min-w-0 overflow-hidden rounded-lg bg-gray-100 p-6 text-sm">
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="leading-5 font-semibold tracking-tight">User goal</p>
          <p className="leading-5">{goal}</p>
        </div>

        <div>
          <p className="leading-5 font-semibold tracking-tight">Target user</p>
          {linkedPersona ? (
            <PersonaDisplay
              personaStudyId={linkedPersona.studyId}
              name={personaData.name}
              description={personaData.description}
              photoUrl={personaData.photoUrl}
              hasAccess={personaData.hasAccess}
            />
          ) : (
            <p className="leading-5">{user ? user : "Not defined"}</p>
          )}
        </div>

        {extraFields}

        {context && (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="leading-5 font-semibold tracking-tight">
              Additional context
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
          <p className="font-semibold text-zinc-700">Created by</p>
          <UserMetadataDisplay user={createdByDisplayUser} className="mt-1" />
        </div>
        <div>
          <p className="font-semibold text-zinc-700">Created on</p>
          <p>{createdAtFormatted}</p>
        </div>
        <div>
          <p className="font-semibold text-zinc-700">Modified by</p>
          <UserMetadataDisplay
            user={lastModifiedByDisplayUser}
            className="mt-1"
          />
        </div>
        <div>
          <p className="font-semibold text-zinc-700">Last modified</p>
          <p>{updatedAtFormatted}</p>
        </div>
      </div>
    </div>
  );
}
