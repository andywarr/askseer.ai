"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Card, CardContent } from "@/apps/nextjs-app/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/apps/nextjs-app/components/ui/popover";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  CircleAlert,
  ListFilter,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import { SeverityBadge } from "@/apps/nextjs-app/components/heuristics/severity-badge";
import {
  calculateGradeLegacy,
  calculateGradeWeighted,
  getGradeThresholds,
} from "@/apps/nextjs-app/utils/grade-utils";
import {
  getSeverityInfo,
  type SeverityRating,
} from "@/apps/nextjs-app/utils/severity";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import {
  sortGroupedResults,
  type HeuristicSortOption,
  type SortDirection,
} from "@/apps/nextjs-app/utils/heuristic-helpers";

const SEVERITY_FILTER_OPTIONS: { value: SeverityRating; label: string }[] = [
  { value: 1, label: "Cosmetic" },
  { value: 2, label: "Minor" },
  { value: 3, label: "Major" },
  { value: 4, label: "Blocker" },
];

type SourceFilterValue = "AI" | "HUMAN" | "AI_HUMAN";

const SOURCE_FILTER_OPTIONS: { value: SourceFilterValue; label: string }[] = [
  { value: "AI", label: "AI" },
  { value: "HUMAN", label: "Human" },
  { value: "AI_HUMAN", label: "Hybrid" },
];

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
  const [selectedSeverities, setSelectedSeverities] = useState<
    SeverityRating[]
  >([]);
  const [selectedSources, setSelectedSources] = useState<SourceFilterValue[]>(
    [],
  );
  const [selectedHeuristicIds, setSelectedHeuristicIds] = useState<string[]>(
    [],
  );
  const [heuristicSearch, setHeuristicSearch] = useState("");
  const [sortBy, setSortBy] = useState<HeuristicSortOption>("heuristic");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const searchParams = useSearchParams();
  const useWeightedScoring = searchParams.get("scoring") === "weighted";

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
  const gradeInfo = useWeightedScoring
    ? calculateGradeWeighted(scoredIssues, totalScreens, totalHeuristics)
    : calculateGradeLegacy(totalIssues, totalScreens);
  const thresholds = getGradeThresholds(useWeightedScoring);

  // Get default open accordion values (heuristics with violations)
  const defaultOpenValues = Object.entries(groupedResults)
    .filter(([, items]) => items.some((item) => item.violated))
    .map(([key]) => key);

  // Filter results based on toggles
  const filteredByViolation = hideNonViolated
    ? Object.fromEntries(
        Object.entries(groupedResults).filter(([, items]) =>
          items.some((item) => item.violated),
        ),
      )
    : groupedResults;

  const filteredBySeverity =
    selectedSeverities.length > 0
      ? Object.entries(filteredByViolation).reduce(
          (acc, [key, items]) => {
            const filtered = items.filter(
              (item) =>
                item.severity !== null &&
                item.severity !== undefined &&
                selectedSeverities.includes(item.severity as SeverityRating),
            );
            if (filtered.length > 0) {
              acc[key] = filtered;
            }
            return acc;
          },
          {} as { [key: string]: HeuristicResult[] },
        )
      : filteredByViolation;

  const filteredBySource =
    selectedSources.length > 0
      ? Object.entries(filteredBySeverity).reduce(
          (acc, [key, items]) => {
            const filtered = items.filter(
              (item) =>
                item.source &&
                selectedSources.includes(item.source as SourceFilterValue),
            );
            if (filtered.length > 0) {
              acc[key] = filtered;
            }
            return acc;
          },
          {} as { [key: string]: HeuristicResult[] },
        )
      : filteredBySeverity;

  const displayedResults =
    selectedHeuristicIds.length > 0
      ? Object.entries(filteredBySource).reduce(
          (acc, [key, items]) => {
            if (selectedHeuristicIds.includes(key)) {
              acc[key] = items;
            }
            return acc;
          },
          {} as { [key: string]: HeuristicResult[] },
        )
      : filteredBySource;

  // Build heuristic filter options from all grouped results (unfiltered)
  const heuristicOptions = Object.entries(groupedResults)
    .map(([key, items]) => ({
      id: key,
      name:
        items[0]?.heuristic?.label ||
        items[0]?.heuristic?.heuristic ||
        items[0]?.heuristic?.name ||
        key,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4">
        {/* Top row: title + stats */}
        <div className="flex flex-row items-baseline justify-between">
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
                    {useWeightedScoring && gradeInfo.qualityScore !== undefined
                      ? `Quality Score: ${gradeInfo.qualityScore}%`
                      : "Average Issues per Screen"}
                  </p>
                  <table className="w-full text-xs">
                    <tbody>
                      {thresholds.map((t) => (
                        <tr
                          key={t.grade}
                          className={
                            t.grade === gradeInfo.grade
                              ? "font-semibold text-white"
                              : "text-zinc-400"
                          }
                        >
                          <td className="py-0.5 pr-3">{t.grade}</td>
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
            <span
              className={`${violatedCount > 0 ? "text-red-500" : "text-zinc-500"} flex items-baseline gap-1 whitespace-nowrap`}
            >
              <span className="text-4xl">{violatedCount}</span>
              <span>{violatedCount === 1 ? "violation" : "violations"}</span>
            </span>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Violated Only Filter */}
          <Button
            variant={hideNonViolated ? "default" : "secondary"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setHideNonViolated(!hideNonViolated)}
          >
            <CircleAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Only show violated</span>
          </Button>

          {/* Heuristic Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8 gap-1.5">
                <ListFilter className="h-4 w-4" />
                <span className="hidden sm:inline">Heuristic</span>
                {selectedHeuristicIds.length > 0 && (
                  <>
                    <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
                    <Badge
                      variant="secondary"
                      className="rounded-sm px-1 font-normal"
                    >
                      {selectedHeuristicIds.length} selected
                    </Badge>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search heuristics..."
                  value={heuristicSearch}
                  onValueChange={setHeuristicSearch}
                />
                <CommandList>
                  <CommandEmpty>No heuristics found.</CommandEmpty>
                  <CommandGroup>
                    {heuristicOptions
                      .filter((h) =>
                        h.name
                          .toLowerCase()
                          .includes(heuristicSearch.toLowerCase()),
                      )
                      .map((option) => {
                        const isSelected = selectedHeuristicIds.includes(
                          option.id,
                        );
                        return (
                          <CommandItem
                            key={option.id}
                            onSelect={() => {
                              setSelectedHeuristicIds(
                                isSelected
                                  ? selectedHeuristicIds.filter(
                                      (id) => id !== option.id,
                                    )
                                  : [...selectedHeuristicIds, option.id],
                              );
                            }}
                          >
                            <div
                              className={cn(
                                "border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible",
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </div>
                            <span className="truncate">{option.name}</span>
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Severity Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8 gap-1.5">
                <TriangleAlert className="h-4 w-4" />
                <span className="hidden sm:inline">Severity</span>
                {selectedSeverities.length > 0 && (
                  <>
                    <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
                    <div className="flex gap-1">
                      {selectedSeverities.length <= 2 ? (
                        selectedSeverities.map((level) => {
                          const info = getSeverityInfo(level);
                          return (
                            <Badge
                              key={level}
                              variant="secondary"
                              className="rounded-sm px-1 font-normal"
                            >
                              {info.label}
                            </Badge>
                          );
                        })
                      ) : (
                        <Badge
                          variant="secondary"
                          className="rounded-sm px-1 font-normal"
                        >
                          {selectedSeverities.length} selected
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {SEVERITY_FILTER_OPTIONS.map((option) => {
                      const isSelected = selectedSeverities.includes(
                        option.value,
                      );
                      const info = getSeverityInfo(option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          onSelect={() => {
                            setSelectedSeverities(
                              isSelected
                                ? selectedSeverities.filter(
                                    (s) => s !== option.value,
                                  )
                                : [...selectedSeverities, option.value],
                            );
                          }}
                        >
                          <div
                            className={cn(
                              "border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible",
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </div>
                          <div
                            className={cn(
                              "mr-2 h-2.5 w-2.5 rounded-full",
                              info.bgColor,
                            )}
                          />
                          <span>{option.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Source Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8 gap-1.5">
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">Source</span>
                {selectedSources.length > 0 && (
                  <>
                    <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
                    <div className="flex gap-1">
                      {selectedSources.length <= 2 ? (
                        selectedSources.map((source) => {
                          const option = SOURCE_FILTER_OPTIONS.find(
                            (o) => o.value === source,
                          );
                          return (
                            <Badge
                              key={source}
                              variant="secondary"
                              className="rounded-sm px-1 font-normal"
                            >
                              {option?.label}
                            </Badge>
                          );
                        })
                      ) : (
                        <Badge
                          variant="secondary"
                          className="rounded-sm px-1 font-normal"
                        >
                          {selectedSources.length} selected
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {SOURCE_FILTER_OPTIONS.map((option) => {
                      const isSelected = selectedSources.includes(option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          onSelect={() => {
                            setSelectedSources(
                              isSelected
                                ? selectedSources.filter(
                                    (s) => s !== option.value,
                                  )
                                : [...selectedSources, option.value],
                            );
                          }}
                        >
                          <div
                            className={cn(
                              "border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible",
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </div>
                          <span>{option.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Clear Filters */}
          {(hideNonViolated ||
            selectedSeverities.length > 0 ||
            selectedSources.length > 0 ||
            selectedHeuristicIds.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 lg:px-3"
              onClick={() => {
                setHideNonViolated(false);
                setSelectedSeverities([]);
                setSelectedSources([]);
                setSelectedHeuristicIds([]);
              }}
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}

          {/* Sort Dropdown */}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5">
                  {sortDirection === "desc" ? (
                    <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {sortBy === "heuristic" ? "Heuristic" : "Violations"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
                  Sort by
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSortBy("heuristic");
                  }}
                >
                  <span className="w-6">
                    {sortBy === "heuristic" && <Check className="h-4 w-4" />}
                  </span>
                  Heuristic
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSortBy("violations");
                  }}
                >
                  <span className="w-6">
                    {sortBy === "violations" && <Check className="h-4 w-4" />}
                  </span>
                  Violations
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
                  Sort direction
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSortDirection("asc");
                  }}
                >
                  <span className="w-6">
                    {sortDirection === "asc" && <Check className="h-4 w-4" />}
                  </span>
                  Ascending
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSortDirection("desc");
                  }}
                >
                  <span className="w-6">
                    {sortDirection === "desc" && <Check className="h-4 w-4" />}
                  </span>
                  Descending
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Accordion matching auth page */}
      {Object.keys(displayedResults).length === 0 &&
      (hideNonViolated ||
        selectedSeverities.length > 0 ||
        selectedSources.length > 0 ||
        selectedHeuristicIds.length > 0) ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          No results match the current filters. Try adjusting your filters to
          see more results.
        </p>
      ) : (
        <Accordion
          type="multiple"
          className="w-full"
          defaultValue={defaultOpenValues}
        >
          {sortGroupedResults(displayedResults, sortBy, sortDirection).map(
            ([key, items]) => {
              const isViolated = items.some((item) => item.violated);
              const violatedItems = items.filter((item) => item.violated);
              const heuristic = items[0]?.heuristic;

              // Calculate stats
              const uniqueSteps = new Set(
                violatedItems.map((item) => item.step),
              );
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
                              <span className="font-semibold">
                                {stepsCount}
                              </span>
                              <span className="text-xs">
                                {stepsCount === 1 ? "screen" : "screens"}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold">
                                {issuesCount}
                              </span>
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
            },
          )}
        </Accordion>
      )}
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
