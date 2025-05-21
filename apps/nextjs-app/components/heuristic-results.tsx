"use client";

import { useState, useCallback } from "react";
import { ViolatedType } from "@prisma/client";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import Image from "next/image";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { InfoCard } from "@/apps/nextjs-app/components/info-card";

interface HeuristicResultsProps {
  groupedResultsByHeuristic: { [key: string]: HEResultData[] };
  violated: number;
  type: string;
  presignedUrls: string[];
  files: any[];
}

export default function HeuristicResults({
  groupedResultsByHeuristic,
  violated: initialViolated,
  type,
  presignedUrls,
  files,
}: HeuristicResultsProps) {
  const [hideNonViolated, setHideNonViolated] = useState(false);
  const [results, setResults] = useState(groupedResultsByHeuristic);
  const [violatedCount, setViolatedCount] = useState(initialViolated);

  const handleDeleteIssue = useCallback(
    (heuristicKey: string, issueId: string) => {
      const currentHeuristicIssues = results[heuristicKey] || [];
      const itemToDelete = currentHeuristicIssues.find(
        (item) => item.id === issueId,
      );

      if (!itemToDelete) return;

      const wasViolated = itemToDelete.violated === ViolatedType.YES;
      const hasOtherViolatedIssues = currentHeuristicIssues.some(
        (item) => item.id !== issueId && item.violated === ViolatedType.YES,
      );

      setResults((prevResults) => {
        const updatedResults = { ...prevResults };
        updatedResults[heuristicKey] = updatedResults[heuristicKey].filter(
          (item) => item.id !== issueId,
        );

        if (updatedResults[heuristicKey].length === 0) {
          delete updatedResults[heuristicKey];
        }

        return updatedResults;
      });

      // Only update violated count if this was a violated issue and there are no other violated issues
      if (wasViolated && !hasOtherViolatedIssues) {
        setViolatedCount((prev) => Math.max(0, prev - 1));
      }
    },
    [results],
  );

  const handleDeleteRecommendation = (
    heuristicKey: string,
    issueId: string,
    recommendationId: string,
  ) => {
    setResults((prevResults) => {
      const updatedResults = { ...prevResults };
      const issueIndex = updatedResults[heuristicKey].findIndex(
        (item) => item.id === issueId,
      );
      if (issueIndex !== -1) {
        updatedResults[heuristicKey][issueIndex] = {
          ...updatedResults[heuristicKey][issueIndex],
          recommendations: updatedResults[heuristicKey][
            issueIndex
          ].recommendations.filter((rec) => rec.id !== recommendationId),
        };
      }
      return updatedResults;
    });
  };

  const filteredGroupedResults = hideNonViolated
    ? Object.entries(results).reduce(
        (acc, [key, items]) => {
          const violatedItems = items.filter(
            (item) => item.violated === ViolatedType.YES,
          );
          if (violatedItems.length > 0) {
            acc[key] = violatedItems;
          }
          return acc;
        },
        {} as { [key: string]: HEResultData[] },
      )
    : results;

  return (
    <>
      <div className="mb-4 flex">
        <div className="flex-grow">
          <p className="font-semibold leading-7 tracking-tight">Heuristics</p>
          <p className="leading-7">{type}</p>
        </div>
        <div className="flex items-baseline gap-4">
          <p className={`${violatedCount > 0 ? "text-red-500" : ""}`}>
            <span className="text-4xl">{violatedCount}</span>
            <span>
              {` violated ${violatedCount === 1 ? "heuristic" : "heuristics"}
              `}
            </span>
          </p>
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

      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={Object.entries(filteredGroupedResults)
          .filter(([_, items]) =>
            items.some((item) => item.violated === ViolatedType.YES),
          )
          .map(([key]) => key)}
      >
        {Object.entries(filteredGroupedResults).map(([key, items]) => {
          const isViolated = items.some(
            (item) => item.violated === ViolatedType.YES,
          );
          const violatedItems = items.filter(
            (item) => item.violated === ViolatedType.YES,
          );

          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4">
                  <span
                    className={`font-medium ${isViolated ? "text-red-500" : ""}`}
                  >
                    {items[0].heuristic?.heuristic || "N/A"}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {!isViolated ? (
                  <p className="py-4 text-zinc-500">No issues found.</p>
                ) : (
                  <div className="space-y-6 py-4">
                    {violatedItems.map((item, index) => [
                      index > 0 && (
                        <div
                          key={`sep-${index}`}
                          className="my-8 h-px w-full bg-zinc-200"
                        />
                      ),
                      <div key={item.id} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {typeof item.step === "number" && (
                            <div className="col-span-1">
                              <Image
                                src={presignedUrls[item.step - 1]}
                                alt={`Step ${item.step} in the user flow`}
                                width={500}
                                height={500}
                                priority={true}
                                unoptimized={true}
                                className="mx-auto h-auto w-full border object-contain p-1 shadow md:mx-0"
                              />
                            </div>
                          )}
                          <div className="col-span-1 mt-4 w-full min-w-0 space-y-4 md:mt-0">
                            <div>
                              <InfoCard
                                id={item.id}
                                studyType="heuristicEvaluation"
                                type="issue"
                                content={item.reason}
                                source={item.source}
                                onDelete={() => handleDeleteIssue(key, item.id)}
                              />
                            </div>
                          </div>
                        </div>
                        {item.recommendations.length > 0 && (
                          <div className="mt-6">
                            <div className="mb-2 pt-4 text-base font-semibold">
                              Recommendations
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {item.recommendations.map((rec) => (
                                <InfoCard
                                  key={rec.id}
                                  id={rec.id}
                                  studyType="heuristicEvaluation"
                                  type="recommendation"
                                  content={rec.recommendation}
                                  source={rec.source}
                                  onDelete={() =>
                                    handleDeleteRecommendation(
                                      key,
                                      item.id,
                                      rec.id,
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>,
                    ])}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}
