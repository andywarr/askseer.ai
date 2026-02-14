"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Card, CardContent } from "@/apps/nextjs-app/components/ui/card";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { SeverityBadge } from "@/apps/nextjs-app/components/heuristics/severity-badge";
import {
  calculateGrade,
  GRADE_THRESHOLDS,
} from "@/apps/nextjs-app/utils/grade-utils";

interface HeuristicResult {
  id: string;
  violated: boolean;
  reason: string | null;
  severity: number | null;
  source?: string;
  step?: number;
  fileId?: string;
  heuristic: {
    id: string;
    heuristic?: string;
    name?: string;
    label?: string;
    category?: string;
    description: string | null;
  };
  recommendations: Array<{
    id: string;
    recommendation: string;
    source?: string;
  }>;
}

interface SharedHeuristicEvaluationProps {
  evaluation: {
    goal: string;
    user: string | null;
    context: string | null;
    heuristicFamily: {
      id: string;
      name: string;
    };
    persona?: {
      id: string;
      name: string;
    } | null;
    results: HeuristicResult[];
  };
  presignedUrls: string[];
  files: Array<{
    id: string;
    key: string;
  }>;
}

export function SharedHeuristicEvaluation({
  evaluation,
  presignedUrls,
  files,
}: SharedHeuristicEvaluationProps) {
  const [hideNonViolated, setHideNonViolated] = useState(false);

  // Group results by heuristic ID
  const groupedResults = evaluation.results.reduce(
    (acc: { [key: string]: HeuristicResult[] }, result) => {
      const key = result.heuristic.id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(result);
      return acc;
    },
    {} as { [key: string]: HeuristicResult[] },
  );

  // Add entries for heuristics from the family that have no results yet
  // This ensures all heuristics are displayed even if they have no issues
  const familyHeuristics =
    (evaluation.heuristicFamily as any)?.heuristics || [];
  for (const heuristic of familyHeuristics) {
    if (!groupedResults[heuristic.id]) {
      // Create a placeholder entry with the heuristic info but no violated results
      groupedResults[heuristic.id] = [
        {
          id: `placeholder-${heuristic.id}`,
          violated: false,
          reason: null,
          severity: null,
          recommendations: [],
          heuristic: heuristic,
        },
      ];
    }
  }

  // Count violated heuristics
  const violatedCount = Object.values(groupedResults).filter((items) =>
    items.some((item) => item.violated),
  ).length;

  const totalIssues = evaluation.results.filter((r) => r.violated).length;
  const totalScreens = presignedUrls.length;
  const totalHeuristics = Object.keys(groupedResults).length;
  const scoredIssues = evaluation.results
    .filter((r) => r.violated)
    .map((r) => ({ severity: r.severity, violated: true }));
  const gradeInfo = calculateGrade(scoredIssues, totalScreens, totalHeuristics);

  // Get default open accordion values (heuristics with violations)
  const defaultOpenValues = Object.entries(groupedResults)
    .filter(([, items]) => items.some((item) => item.violated))
    .map(([key]) => key);

  // Filter results based on toggle
  const displayedResults = hideNonViolated
    ? Object.fromEntries(
        Object.entries(groupedResults).filter(([, items]) =>
          items.some((item) => item.violated),
        ),
      )
    : groupedResults;

  return (
    <div className="mt-8">
      {/* Header matching auth page */}
      <div className="mb-4 flex flex-row items-baseline justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Results
        </h3>
        <div className="flex shrink-0 flex-col items-end gap-4 sm:flex-row sm:items-baseline sm:gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden cursor-help items-baseline gap-1 sm:flex">
                <span
                  className={`text-4xl font-bold ${gradeInfo.colorClass}`}
                >
                  {gradeInfo.grade}
                </span>
                <span className={gradeInfo.colorClass}>grade</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs p-0">
              <div className="p-3">
                <p className="mb-2 text-sm font-semibold">
                  Quality Score: {gradeInfo.qualityScore}%
                </p>
                <table className="w-full text-xs">
                  <tbody>
                    {GRADE_THRESHOLDS.map((t) => (
                      <tr
                        key={t.grade}
                        className={
                          t.grade === gradeInfo.grade
                            ? "font-semibold text-white"
                            : "text-zinc-400"
                        }
                      >
                        <td className="pr-3 py-0.5">{t.grade}</td>
                        <td className="py-0.5">{t.threshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TooltipContent>
          </Tooltip>
          <span className="hidden items-baseline gap-1 sm:flex">
            <span className="text-4xl text-zinc-500">{totalIssues}</span>
            <span className="text-zinc-500">
              {totalIssues === 1 ? "issue" : "issues"}
            </span>
          </span>
          <div className="flex flex-row items-center gap-4">
            <span
              className={`${violatedCount > 0 ? "text-red-500" : "text-zinc-500"} flex items-baseline gap-1 whitespace-nowrap`}
            >
              <span className="text-4xl">{violatedCount}</span>
              <span>{violatedCount === 1 ? "violation" : "violations"}</span>
            </span>
            <div className="flex items-center gap-2">
              <Switch
                checked={hideNonViolated}
                onCheckedChange={setHideNonViolated}
                aria-label="Toggle non-violated heuristics"
              />
              <span className="text-sm text-zinc-500">Only show violated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion matching auth page */}
      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={defaultOpenValues}
      >
        {Object.entries(displayedResults)
          .sort(([, itemsA], [, itemsB]) => {
            const nameA =
              itemsA[0]?.heuristic?.heuristic ||
              itemsA[0]?.heuristic?.name ||
              "N/A";
            const nameB =
              itemsB[0]?.heuristic?.heuristic ||
              itemsB[0]?.heuristic?.name ||
              "N/A";
            return nameA.localeCompare(nameB);
          })
          .map(([key, items]) => {
            const isViolated = items.some((item) => item.violated);
            const violatedItems = items.filter((item) => item.violated);
            const heuristic = items[0]?.heuristic;

            // Calculate stats
            const uniqueSteps = new Set(violatedItems.map((item) => item.step));
            const stepsCount = uniqueSteps.size;
            const issuesCount = violatedItems.length;
            const recommendationsCount = violatedItems.reduce(
              (total, item) => total + (item.recommendations?.length || 0),
              0,
            );

            return (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger sticky className="hover:no-underline">
                  <div className="flex w-full items-center justify-between gap-4">
                    <div
                      className={`font-medium ${isViolated ? "text-red-500" : ""}`}
                    >
                      <span className="font-semibold">
                        {heuristic?.label ||
                          heuristic?.heuristic ||
                          heuristic?.name ||
                          "N/A"}
                        {heuristic?.label && ": "}
                      </span>
                      {heuristic?.label && (
                        <span>{heuristic?.heuristic || heuristic?.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {heuristic?.label && heuristic?.category && (
                        <Badge
                          variant="outline"
                          className={`${isViolated ? "text-red-500" : ""}`}
                        >
                          {heuristic.category}
                        </Badge>
                      )}
                      {isViolated && (
                        <div className="hidden gap-4 text-sm text-zinc-500 md:flex">
                          <div className="flex flex-col">
                            <span className="font-semibold">{stepsCount}</span>
                            <span className="text-xs">
                              {stepsCount === 1 ? "screen" : "screens"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold">{issuesCount}</span>
                            <span className="text-xs">
                              {issuesCount === 1 ? "issue" : "issues"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {recommendationsCount}
                            </span>
                            <span className="text-xs">
                              {recommendationsCount === 1
                                ? "recommendation"
                                : "recommendations"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {!isViolated ? (
                    <p className="py-4 text-zinc-500">No issues found.</p>
                  ) : (
                    <div className="space-y-6 py-4">
                      {violatedItems.map((item, index) => {
                        const isFirstForStep =
                          violatedItems.findIndex(
                            (i) => i.step === item.step,
                          ) === index;

                        // Find the presigned URL for this step
                        const stepIndex =
                          typeof item.step === "number" ? item.step - 1 : -1;
                        const imageUrl =
                          stepIndex >= 0 ? presignedUrls[stepIndex] : null;

                        return (
                          <div key={item.id}>
                            {index > 0 && (
                              <Separator className="mx-auto my-6 w-1/2" />
                            )}
                            <SharedIssueItem
                              item={item}
                              isFirstForStep={isFirstForStep}
                              imageUrl={imageUrl}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
      </Accordion>
    </div>
  );
}

function SharedIssueItem({
  item,
  isFirstForStep,
  imageUrl,
}: {
  item: HeuristicResult;
  isFirstForStep: boolean;
  imageUrl: string | null;
}) {
  const getSourceLabel = (source?: string) => {
    if (!source) return null;
    switch (source) {
      case "AI":
        return "Generated by AI";
      case "AI_HUMAN":
        return "Generated by AI, edited by a human";
      case "HUMAN":
        return "Created by a human";
      default:
        return source;
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`grid grid-cols-1 gap-4 ${
          isFirstForStep && imageUrl ? "md:grid-cols-2" : ""
        }`}
      >
        {isFirstForStep && imageUrl && (
          <div className="col-span-1">
            <Image
              src={imageUrl}
              alt={`Step ${item.step} in the user flow`}
              width={500}
              height={500}
              priority={true}
              unoptimized={true}
              className="mx-auto h-auto max-h-96 w-full border object-contain p-1 shadow-sm md:mx-0"
            />
          </div>
        )}
        <div
          className={`col-span-1 mt-4 w-full min-w-0 space-y-4 md:mt-0 ${
            isFirstForStep && imageUrl ? "md:pl-4" : "md:col-span-2"
          }`}
        >
          {/* Issue content - no border, no title */}
          <div className="py-4 text-sm">
            <p className="pr-8 text-zinc-900 dark:text-zinc-100">
              {item.reason}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2 pt-4 text-xs text-gray-500">
              <span>{getSourceLabel(item.source)}</span>
              {item.severity !== null && item.severity !== undefined && (
                <SeverityBadge severity={item.severity as 1 | 2 | 3 | 4} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {item.recommendations.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 pt-4 text-base font-semibold">
            Recommendations
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {item.recommendations.map((rec) => (
              <Card key={rec.id} className="pt-4">
                <CardContent>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {rec.recommendation}
                  </p>
                  {rec.source && (
                    <p className="mt-2 text-xs text-gray-500">
                      {getSourceLabel(rec.source)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
