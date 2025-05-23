"use client";

import { useState, useCallback } from "react";
import { ViolatedType } from "@prisma/client";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import Image from "next/image";
import { createRecommendation } from "@/apps/nextjs-app/lib/data";
import { toast } from "sonner";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";

import { InfoCard } from "@/apps/nextjs-app/components/info-card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";

interface HeuristicResultsProps {
  groupedResultsByHeuristic: { [key: string]: HEResultData[] };
  violated: number;
  type: string;
  presignedUrls: string[];
  files: any[];
  studyId: string;
  userId: string;
}

export default function HeuristicResults({
  groupedResultsByHeuristic,
  violated: initialViolated,
  type,
  presignedUrls,
  files,
  studyId,
  userId,
}: HeuristicResultsProps) {
  const [hideNonViolated, setHideNonViolated] = useState(false);
  const [results, setResults] = useState(groupedResultsByHeuristic);
  const [violatedCount, setViolatedCount] = useState(initialViolated);
  const [editingRecommendationFor, setEditingRecommendationFor] = useState<
    string | null
  >(null);
  const [newRecommendation, setNewRecommendation] = useState("");
  const isMobile = useIsMobile();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const [newIssueDescription, setNewIssueDescription] = useState("");

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

  const handleSaveNewRecommendation = (
    heuristicKey: string,
    issueId: string,
  ) => {
    if (!newRecommendation.trim()) return;
    setResults((prevResults) => {
      const updatedResults = { ...prevResults };
      const issueIndex = updatedResults[heuristicKey].findIndex(
        (item) => item.id === issueId,
      );
      if (issueIndex !== -1) {
        updatedResults[heuristicKey][issueIndex] = {
          ...updatedResults[heuristicKey][issueIndex],
          recommendations: [
            ...updatedResults[heuristicKey][issueIndex].recommendations,
            {
              id: `new-${Date.now()}`,
              resultId: issueId,
              recommendation: newRecommendation,
              source: "HUMAN",
            },
          ],
        };
      }
      return updatedResults;
    });
    setNewRecommendation("");
    setEditingRecommendationFor(null);
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
                      index > 0 && <Separator className="mx-auto w-1/2" />,
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
                                onDelete={async () => {
                                  try {
                                    handleDeleteIssue(key, item.id);
                                    const { getHeuristicEvaluation } =
                                      await import(
                                        "@/apps/nextjs-app/lib/data"
                                      );
                                    const study = await getHeuristicEvaluation(
                                      studyId,
                                      userId,
                                    );
                                    if (!study || !study.heuristicEvaluation)
                                      throw new Error(
                                        "Failed to fetch updated data",
                                      );
                                    const groupedResultsByHeuristic =
                                      study.heuristicEvaluation.results.reduce(
                                        (
                                          acc: { [key: string]: any[] },
                                          result: any,
                                        ) => {
                                          if (!acc[result.heuristicId]) {
                                            acc[result.heuristicId] = [];
                                          }
                                          acc[result.heuristicId].push(result);
                                          return acc;
                                        },
                                        {},
                                      );
                                    Object.keys(
                                      groupedResultsByHeuristic,
                                    ).forEach((key) => {
                                      groupedResultsByHeuristic[key].sort(
                                        (a, b) => {
                                          if (
                                            a.step === undefined &&
                                            b.step === undefined
                                          )
                                            return 0;
                                          if (a.step === undefined) return 1;
                                          if (b.step === undefined) return -1;
                                          return a.step - b.step;
                                        },
                                      );
                                    });
                                    // After regrouping results, sort recommendations by id (ascending)
                                    Object.keys(
                                      groupedResultsByHeuristic,
                                    ).forEach((key) => {
                                      groupedResultsByHeuristic[key].forEach(
                                        (result: HEResultData) => {
                                          if (
                                            result.recommendations &&
                                            Array.isArray(
                                              result.recommendations,
                                            )
                                          ) {
                                            result.recommendations.sort(
                                              (a: any, b: any) =>
                                                a.id.localeCompare(b.id),
                                            );
                                          }
                                        },
                                      );
                                    });
                                    setResults(groupedResultsByHeuristic);
                                  } catch (error) {
                                    toast.error(
                                      "Failed to delete issue. Please try again.",
                                    );
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-6">
                          <div className="mb-2 pt-4 text-base font-semibold">
                            Recommendations
                          </div>
                          <div className="relative grid min-h-[80px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {item.recommendations.map((rec) => (
                              <InfoCard
                                key={rec.id}
                                id={rec.id}
                                studyType="heuristicEvaluation"
                                type="recommendation"
                                content={rec.recommendation}
                                source={rec.source}
                                onDelete={async () => {
                                  try {
                                    handleDeleteRecommendation(
                                      key,
                                      item.id,
                                      rec.id,
                                    );
                                    const { getHeuristicEvaluation } =
                                      await import(
                                        "@/apps/nextjs-app/lib/data"
                                      );
                                    const study = await getHeuristicEvaluation(
                                      studyId,
                                      userId,
                                    );
                                    if (!study || !study.heuristicEvaluation)
                                      throw new Error(
                                        "Failed to fetch updated data",
                                      );
                                    const groupedResultsByHeuristic =
                                      study.heuristicEvaluation.results.reduce(
                                        (
                                          acc: { [key: string]: any[] },
                                          result: any,
                                        ) => {
                                          if (!acc[result.heuristicId]) {
                                            acc[result.heuristicId] = [];
                                          }
                                          acc[result.heuristicId].push(result);
                                          return acc;
                                        },
                                        {},
                                      );
                                    Object.keys(
                                      groupedResultsByHeuristic,
                                    ).forEach((key) => {
                                      groupedResultsByHeuristic[key].sort(
                                        (a, b) => {
                                          if (
                                            a.step === undefined &&
                                            b.step === undefined
                                          )
                                            return 0;
                                          if (a.step === undefined) return 1;
                                          if (b.step === undefined) return -1;
                                          return a.step - b.step;
                                        },
                                      );
                                    });
                                    // After regrouping results, sort recommendations by id (ascending)
                                    Object.keys(
                                      groupedResultsByHeuristic,
                                    ).forEach((key) => {
                                      groupedResultsByHeuristic[key].forEach(
                                        (result: HEResultData) => {
                                          if (
                                            result.recommendations &&
                                            Array.isArray(
                                              result.recommendations,
                                            )
                                          ) {
                                            result.recommendations.sort(
                                              (a: any, b: any) =>
                                                a.id.localeCompare(b.id),
                                            );
                                          }
                                        },
                                      );
                                    });
                                    setResults(groupedResultsByHeuristic);
                                  } catch (error) {
                                    toast.error(
                                      "Failed to delete recommendation. Please try again.",
                                    );
                                  }
                                }}
                              />
                            ))}
                            {editingRecommendationFor === item.id ? (
                              <InfoCard
                                id={`new-${item.id}`}
                                studyType="heuristicEvaluation"
                                type="recommendation"
                                content={newRecommendation}
                                source="HUMAN"
                                isEditing={true}
                                onSave={async (content) => {
                                  setNewRecommendation("");
                                  setEditingRecommendationFor(null);
                                  if (!content.trim()) return;
                                  try {
                                    const { data: rec } =
                                      await createRecommendation(
                                        "heuristicEvaluation",
                                        item.id,
                                        content,
                                        "HUMAN",
                                      );
                                    // Refetch latest data
                                    const { getHeuristicEvaluation } =
                                      await import(
                                        "@/apps/nextjs-app/lib/data"
                                      );
                                    const study = await getHeuristicEvaluation(
                                      studyId,
                                      userId,
                                    );
                                    if (!study || !study.heuristicEvaluation)
                                      throw new Error(
                                        "Failed to fetch updated data",
                                      );
                                    // Regroup results
                                    const groupedResultsByHeuristic =
                                      study.heuristicEvaluation.results.reduce(
                                        (
                                          acc: { [key: string]: any[] },
                                          result: any,
                                        ) => {
                                          if (!acc[result.heuristicId]) {
                                            acc[result.heuristicId] = [];
                                          }
                                          acc[result.heuristicId].push(result);
                                          return acc;
                                        },
                                        {},
                                      );
                                    // Sort each group by step if it exists
                                    Object.keys(
                                      groupedResultsByHeuristic,
                                    ).forEach((key) => {
                                      groupedResultsByHeuristic[key].sort(
                                        (a, b) => {
                                          if (
                                            a.step === undefined &&
                                            b.step === undefined
                                          )
                                            return 0;
                                          if (a.step === undefined) return 1;
                                          if (b.step === undefined) return -1;
                                          return a.step - b.step;
                                        },
                                      );
                                    });
                                    // After regrouping results, sort recommendations by id (ascending)
                                    Object.keys(
                                      groupedResultsByHeuristic,
                                    ).forEach((key) => {
                                      groupedResultsByHeuristic[key].forEach(
                                        (result: HEResultData) => {
                                          if (
                                            result.recommendations &&
                                            Array.isArray(
                                              result.recommendations,
                                            )
                                          ) {
                                            result.recommendations.sort(
                                              (a: any, b: any) =>
                                                a.id.localeCompare(b.id),
                                            );
                                          }
                                        },
                                      );
                                    });
                                    setResults(groupedResultsByHeuristic);
                                    toast.success(
                                      "Successfully added recommendation.",
                                    );
                                  } catch (error) {
                                    toast.error(
                                      "Failed to add recommendation. Please try again.",
                                    );
                                  }
                                }}
                                onCancel={() => {
                                  setEditingRecommendationFor(null);
                                  setNewRecommendation("");
                                }}
                                onEdit={async (newContent) => {
                                  try {
                                    // Existing edit logic (if any)
                                    // Refetch latest data
                                    const { getHeuristicEvaluation } =
                                      await import(
                                        "@/apps/nextjs-app/lib/data"
                                      );
                                    const study = await getHeuristicEvaluation(
                                      studyId,
                                      userId,
                                    );
                                    if (!study || !study.heuristicEvaluation)
                                      throw new Error(
                                        "Failed to fetch updated data",
                                      );
                                    const groupedResultsByHeuristic =
                                      study.heuristicEvaluation.results.reduce(
                                        (
                                          acc: { [key: string]: any[] },
                                          result: any,
                                        ) => {
                                          if (!acc[result.heuristicId]) {
                                            acc[result.heuristicId] = [];
                                          }
                                          acc[result.heuristicId].push(result);
                                          return acc;
                                        },
                                        {},
                                      );
                                    Object.keys(
                                      groupedResultsByHeuristic,
                                    ).forEach((key) => {
                                      groupedResultsByHeuristic[key].sort(
                                        (a, b) => {
                                          if (
                                            a.step === undefined &&
                                            b.step === undefined
                                          )
                                            return 0;
                                          if (a.step === undefined) return 1;
                                          if (b.step === undefined) return -1;
                                          return a.step - b.step;
                                        },
                                      );
                                    });
                                    // After regrouping results, sort recommendations by id (ascending)
                                    Object.keys(
                                      groupedResultsByHeuristic,
                                    ).forEach((key) => {
                                      groupedResultsByHeuristic[key].forEach(
                                        (result: HEResultData) => {
                                          if (
                                            result.recommendations &&
                                            Array.isArray(
                                              result.recommendations,
                                            )
                                          ) {
                                            result.recommendations.sort(
                                              (a: any, b: any) =>
                                                a.id.localeCompare(b.id),
                                            );
                                          }
                                        },
                                      );
                                    });
                                    setResults(groupedResultsByHeuristic);
                                  } catch (error) {
                                    toast.error(
                                      "Failed to update recommendation. Please try again.",
                                    );
                                  }
                                }}
                              />
                            ) : (
                              !isMobile && (
                                <div className="flex h-full items-end justify-start">
                                  <Button
                                    variant="link"
                                    onClick={() =>
                                      setEditingRecommendationFor(item.id)
                                    }
                                  >
                                    Add recommendation
                                  </Button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>,
                    ])}
                  </div>
                )}
                <Separator className="mx-auto w-1/2" />
                <div className="flex justify-center">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="mt-4" variant="outline">
                        Add issue
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>New issue</DialogTitle>
                      </DialogHeader>
                      <div className="mb-4">
                        <label className="mb-2 block font-medium">
                          Which step is the issue?
                        </label>
                        <Select
                          value={
                            selectedImageIndex !== null
                              ? String(selectedImageIndex)
                              : ""
                          }
                          onValueChange={(val) =>
                            setSelectedImageIndex(Number(val))
                          }
                        >
                          <SelectTrigger className="h-9 w-full">
                            {selectedImageIndex !== null ? (
                              <div className="flex items-center gap-2">
                                <Image
                                  src={presignedUrls[selectedImageIndex]}
                                  alt={`Step ${selectedImageIndex + 1}`}
                                  width={48}
                                  height={48}
                                  className="rounded border object-contain"
                                  priority
                                  unoptimized
                                />
                                <span>Step {selectedImageIndex + 1}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-500">
                                Choose a step...
                              </span>
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {presignedUrls.map((url, idx) => (
                              <SelectItem key={idx} value={String(idx)}>
                                <div className="flex items-center gap-2">
                                  <Image
                                    src={url}
                                    alt={`Step ${idx + 1}`}
                                    width={128}
                                    height={128}
                                    className="rounded border object-contain"
                                    priority
                                    unoptimized
                                  />
                                  <span>Step {idx + 1}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mb-4">
                        <label className="mb-2 block font-medium">
                          What is the issue?
                        </label>
                        <Textarea
                          value={newIssueDescription}
                          onChange={(e) =>
                            setNewIssueDescription(e.target.value)
                          }
                          placeholder="Describe the issue..."
                          rows={4}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={
                          selectedImageIndex === null ||
                          !newIssueDescription.trim()
                        }
                      >
                        Add
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}
