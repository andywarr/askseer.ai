import {
  StudyMetadataCard as SharedStudyMetadataCard,
  type PersonaData,
  type DisplayUser,
} from "@/apps/nextjs-app/components/study/study-metadata-card";
import { useTranslations } from "next-intl";

interface EvaluationStudyMetadataCardProps {
  goal: string;
  user: string | null;
  heuristicFamilyName: string;
  context: string | null;
  presignedUrls: string[];
  linkedPersona: { studyId: string } | null | undefined;
  personaData: PersonaData;
  createdByDisplayUser: DisplayUser | null;
  lastModifiedByDisplayUser: DisplayUser | null;
  createdAtFormatted: string;
  updatedAtFormatted: string;
}

export function StudyMetadataCard({
  heuristicFamilyName,
  ...props
}: EvaluationStudyMetadataCardProps) {
  const t = useTranslations("StudyMetadata");

  return (
    <SharedStudyMetadataCard
      {...props}
      extraFields={
        <div>
          <p className="leading-5 font-semibold tracking-tight">{t("heuristics")}</p>
          <p className="leading-5">{heuristicFamilyName}</p>
        </div>
      }
    />
  );
}
