"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import { useHeuristicResults } from "@/apps/nextjs-app/hooks/use-heuristic-results";
import {
  filterNonViolatedResults,
  filterBySeverity,
  filterBySource,
  filterByHeuristic,
  sortGroupedResults,
  type SourceFilterValue,
  type HeuristicSortOption,
  type SortDirection,
} from "@/apps/nextjs-app/utils/heuristic-helpers";
import type { SeverityRating } from "@/apps/nextjs-app/utils/severity";
import {
  HeuristicHeader,
  type HeuristicFilterOption,
} from "./heuristic-header";
import { HeuristicAccordion } from "./heuristic-accordion";
import { AddToFigmaAlert } from "@/apps/nextjs-app/components/figma/add-to-figma-alert";
import { AddToFigmaDialog } from "@/apps/nextjs-app/components/figma/add-to-figma-dialog";
import {
  hasFigmaFiles,
  extractHeuristicEvaluationIssues,
  type IssueComment,
} from "@/apps/nextjs-app/lib/figma/comments";

interface HeuristicResultsProps {
  groupedResultsByHeuristic: { [key: string]: HEResultData[] };
  violated: number;
  presignedUrls: string[];
  files: any[];
  studyId: string;
  userId: string;
  heuristicEvaluationId: string;
  canManage?: boolean;
}

export default function HeuristicResults({
  groupedResultsByHeuristic,
  violated: initialViolated,
  presignedUrls,
  files,
  studyId,
  userId,
  heuristicEvaluationId,
  canManage = true,
}: HeuristicResultsProps) {
  const [hideNonViolated, setHideNonViolated] = useState(false);
  const [selectedSeverities, setSelectedSeverities] = useState<
    SeverityRating[]
  >([]);
  const [selectedSources, setSelectedSources] = useState<SourceFilterValue[]>(
    [],
  );
  const [selectedHeuristicIds, setSelectedHeuristicIds] = useState<string[]>(
    [],
  );
  const [sortBy, setSortBy] = useState<HeuristicSortOption>("heuristic");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isPrinting, setIsPrinting] = useState(false);
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false);
  const [figmaIssues, setFigmaIssues] = useState<IssueComment[]>([]);

  useEffect(() => {
    const before = () => setIsPrinting(true);
    const after = () => setIsPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const {
    results,
    violatedCount,
    setViolatedCount,
    refreshResults,
    deleteIssue,
    deleteRecommendation,
  } = useHeuristicResults(
    groupedResultsByHeuristic,
    initialViolated,
    studyId,
    userId,
  );

  const filteredByViolation =
    hideNonViolated && !isPrinting
      ? filterNonViolatedResults(results, hideNonViolated)
      : results;

  const filteredBySeverity =
    selectedSeverities.length > 0 && !isPrinting
      ? filterBySeverity(filteredByViolation, selectedSeverities)
      : filteredByViolation;

  const filteredBySource =
    selectedSources.length > 0 && !isPrinting
      ? filterBySource(filteredBySeverity, selectedSources)
      : filteredBySeverity;

  const displayedResults =
    selectedHeuristicIds.length > 0 && !isPrinting
      ? filterByHeuristic(filteredBySource, selectedHeuristicIds)
      : filteredBySource;

  // Sort the displayed results
  const sortedEntries = useMemo(
    () => sortGroupedResults(displayedResults, sortBy, sortDirection),
    [displayedResults, sortBy, sortDirection],
  );

  // Build heuristic filter options from all results (unfiltered)
  const heuristicOptions: HeuristicFilterOption[] = useMemo(() => {
    return Object.entries(results)
      .map(([key, items]) => ({
        id: key,
        name:
          (items[0]?.heuristic as any)?.label ||
          (items[0]?.heuristic as any)?.heuristic ||
          (items[0]?.heuristic as any)?.name ||
          key,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [results]);

  const totalIssues = useMemo(() => {
    return Object.values(results).reduce((total, items) => {
      return total + items.filter((item) => item.violated).length;
    }, 0);
  }, [results]);

  const scoredIssues = useMemo(() => {
    return Object.values(results)
      .flat()
      .filter((item) => item.violated)
      .map((item) => ({ severity: item.severity, violated: true }));
  }, [results]);

  // Number of distinct heuristics in the family (keys include placeholders)
  const totalHeuristics = useMemo(
    () => Object.keys(results).length,
    [results],
  );

  const handleDeleteIssue = useCallback(
    (heuristicKey: string, issueId: string) => {
      if (!canManage) return;
      deleteIssue(heuristicKey, issueId);
    },
    [canManage, deleteIssue],
  );

  const handleDeleteRecommendation = useCallback(
    (heuristicKey: string, issueId: string, recommendationId: string) => {
      if (!canManage) return;
      deleteRecommendation(heuristicKey, issueId, recommendationId);
    },
    [canManage, deleteRecommendation],
  );

  // Check if study has Figma files
  const studyHasFigmaFiles = hasFigmaFiles(files);

  const handleAddToFigma = useCallback(() => {
    // Flatten results to extract issues
    const allResults = Object.values(results).flat();
    const issues = extractHeuristicEvaluationIssues(allResults, files);
    setFigmaIssues(issues);
    setFigmaDialogOpen(true);
  }, [results, files]);

  return (
    <>
      <HeuristicHeader
        violatedCount={violatedCount}
        totalIssues={totalIssues}
        scoredIssues={scoredIssues}
        totalScreens={presignedUrls.length}
        totalHeuristics={totalHeuristics}
        hideNonViolated={hideNonViolated}
        onToggleNonViolated={setHideNonViolated}
        selectedSeverities={selectedSeverities}
        onSeverityFilterChange={setSelectedSeverities}
        selectedSources={selectedSources}
        onSourceFilterChange={setSelectedSources}
        heuristicOptions={heuristicOptions}
        selectedHeuristicIds={selectedHeuristicIds}
        onHeuristicFilterChange={setSelectedHeuristicIds}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={setSortBy}
        onSortDirectionChange={setSortDirection}
      />

      <AddToFigmaAlert
        hasFigmaFiles={studyHasFigmaFiles}
        onAddToFigma={handleAddToFigma}
      />

      {Object.keys(displayedResults).length === 0 &&
      (hideNonViolated ||
        selectedSeverities.length > 0 ||
        selectedSources.length > 0 ||
        selectedHeuristicIds.length > 0) ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          No results match the current filters. Try adjusting your filters to
          see results.
        </p>
      ) : (
        <HeuristicAccordion
          groupedResults={displayedResults}
          sortedEntries={sortedEntries}
          presignedUrls={presignedUrls}
          files={files}
          studyId={studyId}
          userId={userId}
          heuristicEvaluationId={heuristicEvaluationId}
          onDeleteIssue={canManage ? handleDeleteIssue : undefined}
          onDeleteRecommendation={
            canManage ? handleDeleteRecommendation : undefined
          }
          onRefreshResults={refreshResults}
          onUpdateViolatedCount={setViolatedCount}
          canManage={canManage}
        />
      )}

      <AddToFigmaDialog
        open={figmaDialogOpen}
        onOpenChange={setFigmaDialogOpen}
        issues={figmaIssues}
        isCognitiveWalkthrough={false}
      />
    </>
  );
}
