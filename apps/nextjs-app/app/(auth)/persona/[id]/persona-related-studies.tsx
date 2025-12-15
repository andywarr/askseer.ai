"use client";

import { useState } from "react";
import { StudyCard } from "@/apps/nextjs-app/components/study-card";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { StudyStatus, StudyType } from "@prisma/client";

type StudyUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type AssociatedStudy = {
  id: string;
  name: string | null;
  type: StudyType;
  status: StudyStatus;
  createdByUserId: string;
  files?: Array<{ key?: string | null } | null> | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  createdByUser?: StudyUser | null;
  lastModifiedByUser?: StudyUser | null;
};

interface PersonaRelatedStudiesProps {
  studies: AssociatedStudy[];
  studyPreviewMap: Map<string, string | null>;
  studyVersionMap: Map<string, number>;
  currentUserId: string;
  currentVersion: number;
}

export function PersonaRelatedStudies({
  studies,
  studyPreviewMap,
  studyVersionMap,
  currentUserId,
  currentVersion,
}: PersonaRelatedStudiesProps) {
  const [showCurrentVersionOnly, setShowCurrentVersionOnly] = useState(false);

  const filteredStudies = showCurrentVersionOnly
    ? studies.filter(
        (study) => studyVersionMap.get(study.id) === currentVersion,
      )
    : studies;

  return (
    <section
      className="pb-12 pl-0 md:pl-48"
      aria-labelledby="persona-associated-studies"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="persona-associated-studies"
          className="text-lg font-semibold tracking-tight"
        >
          Related studies
        </h2>
        <div className="flex items-center gap-2">
          <Switch
            id="current-version-only"
            checked={showCurrentVersionOnly}
            onCheckedChange={setShowCurrentVersionOnly}
          />
          <Label
            htmlFor="current-version-only"
            className="cursor-pointer text-sm font-normal"
          >
            Current version only
          </Label>
        </div>
      </div>
      {filteredStudies.length > 0 ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4">
            {filteredStudies.map((associatedStudy) => {
              const previewUrl =
                studyPreviewMap.get(associatedStudy.id) ?? undefined;
              const personaVersion = studyVersionMap.get(associatedStudy.id);

              return (
                <StudyCard
                  key={associatedStudy.id}
                  study={associatedStudy}
                  currentUserId={currentUserId}
                  previewUrl={previewUrl}
                  canManage={associatedStudy.createdByUserId === currentUserId}
                  className="max-w-[320px] min-w-[320px] flex-shrink-0"
                  imageClassName="h-40"
                  personaVersion={personaVersion}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No studies found for this version.
        </p>
      )}
    </section>
  );
}
