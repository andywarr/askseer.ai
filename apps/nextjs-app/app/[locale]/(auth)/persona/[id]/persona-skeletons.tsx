"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

/**
 * Skeleton loader for persona version cards in the version history section.
 */
export function PersonaVersionsSkeleton() {
  const t = useTranslations("PersonaDetail.skeletons");
  return (
    <section className="pb-12 pl-0 md:pl-48" aria-label={t("loadingVersionHistory")}>
      <div className="mb-3 h-6 w-36">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="max-w-[320px] min-w-[320px] flex-shrink-0 rounded-lg border p-0"
            >
              <Skeleton className="h-40 w-full rounded-t-lg" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Skeleton loader for related studies section.
 */
export function PersonaRelatedStudiesSkeleton() {
  const t = useTranslations("PersonaDetail.skeletons");
  return (
    <section className="pb-12 pl-0 md:pl-48" aria-label={t("loadingRelatedStudies")}>
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-10 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="max-w-[320px] min-w-[320px] flex-shrink-0 rounded-lg border p-0"
            >
              <Skeleton className="h-40 w-full rounded-t-lg" />
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Skeleton loader for persona section cards (Demographics, Psychographics, etc.).
 */
export function PersonaSectionSkeleton({ itemCount = 6 }: { itemCount?: number }) {
  const t = useTranslations("PersonaDetail.skeletons");
  return (
    <section className="pb-10 pl-0 md:pl-48" aria-label={t("loadingSection")}>
      <Skeleton className="mb-3 h-6 w-32" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border p-3"
          >
            <Skeleton className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
