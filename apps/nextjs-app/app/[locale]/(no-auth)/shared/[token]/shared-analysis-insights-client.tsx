"use client";

import { AnalysisInsights } from "@/apps/nextjs-app/app/[locale]/(auth)/analysis/[id]/analysis-insights";
import { EditableSummary } from "@/apps/nextjs-app/app/[locale]/(auth)/analysis/[id]/editable-summary";

export function SharedAnalysisInsightsClient({
  insights,
  studyId,
  qualitativeAnalysisId,
  sourceFiles,
  summary,
  summarySource,
  studyLocale = "en",
}: any) {
  return (
    <div className="mt-8">
      {summary && (
        <EditableSummary
          summary={summary}
          summarySource={summarySource}
          qualitativeAnalysisId={qualitativeAnalysisId}
          userId=""
          studyId={studyId}
          canEdit={false}
          updateSummary={async () => ({ success: false, error: "Read only" })}
          studyLocale={studyLocale}
        />
      )}
      <AnalysisInsights
      insights={insights}
      studyId={studyId}
      canEdit={false}
      userId=""
      qualitativeAnalysisId={qualitativeAnalysisId}
      sourceFiles={sourceFiles}
      updateInsight={async () => ({ success: false, error: "Read only" })}
      deleteQuote={async () => ({ success: false, error: "Read only" })}
      addTag={async () => ({ success: false, error: "Read only" })}
      removeTag={async () => ({ success: false, error: "Read only" })}
      deleteInsight={async () => ({ success: false, error: "Read only" })}
      addQuote={async () => ({ success: false, error: "Read only" })}
      addInsight={async () => ({ success: false, error: "Read only" })}
      studyLocale={studyLocale}
    />
    </div>
  );
}
