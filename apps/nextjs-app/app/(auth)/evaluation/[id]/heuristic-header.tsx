import { memo, useState } from "react";
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
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Button } from "@/apps/nextjs-app/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import {
  calculateGrade,
  GRADE_THRESHOLDS,
  type ScoredIssue,
} from "@/apps/nextjs-app/utils/grade-utils";
import {
  getSeverityInfo,
  type SeverityRating,
} from "@/apps/nextjs-app/utils/severity";
import type {
  HeuristicSortOption,
  SortDirection,
} from "@/apps/nextjs-app/utils/heuristic-helpers";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

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

export interface HeuristicFilterOption {
  id: string;
  name: string;
}

interface HeuristicHeaderProps {
  violatedCount: number;
  totalIssues: number;
  scoredIssues: ScoredIssue[];
  totalScreens: number;
  totalHeuristics: number;
  hideNonViolated: boolean;
  onToggleNonViolated: (checked: boolean) => void;
  selectedSeverities: SeverityRating[];
  onSeverityFilterChange: (severities: SeverityRating[]) => void;
  selectedSources: SourceFilterValue[];
  onSourceFilterChange: (sources: SourceFilterValue[]) => void;
  heuristicOptions: HeuristicFilterOption[];
  selectedHeuristicIds: string[];
  onHeuristicFilterChange: (ids: string[]) => void;
  sortBy: HeuristicSortOption;
  sortDirection: SortDirection;
  onSortChange: (sortBy: HeuristicSortOption) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
}

function HeuristicHeaderComponent({
  violatedCount,
  totalIssues,
  scoredIssues,
  totalScreens,
  totalHeuristics,
  hideNonViolated,
  onToggleNonViolated,
  selectedSeverities,
  onSeverityFilterChange,
  selectedSources,
  onSourceFilterChange,
  heuristicOptions,
  selectedHeuristicIds,
  onHeuristicFilterChange,
  sortBy,
  sortDirection,
  onSortChange,
  onSortDirectionChange,
}: HeuristicHeaderProps) {
  const gradeInfo = calculateGrade(totalIssues, totalScreens);
  const [heuristicSearch, setHeuristicSearch] = useState("");

  const hasActiveFilters =
    hideNonViolated ||
    selectedSeverities.length > 0 ||
    selectedSources.length > 0 ||
    selectedHeuristicIds.length > 0;

  return (
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
                <span className={`text-4xl font-bold ${gradeInfo.colorClass}`}>
                  {gradeInfo.grade}
                </span>
                <span className={gradeInfo.colorClass}>grade</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs p-0">
              <div className="p-3">
                <p className="mb-2 text-sm font-semibold">
                  Average Issues per Screen
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
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {/* Violated Only Filter */}
        <Button
          variant={hideNonViolated ? "default" : "secondary"}
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => onToggleNonViolated(!hideNonViolated)}
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
                            onHeuristicFilterChange(
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
                          onSeverityFilterChange(
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
                          onSourceFilterChange(
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
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 lg:px-3"
            onClick={() => {
              onToggleNonViolated(false);
              onSeverityFilterChange([]);
              onSourceFilterChange([]);
              onHeuristicFilterChange([]);
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
                  onSortChange("heuristic");
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
                  onSortChange("violations");
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
                  onSortDirectionChange("asc");
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
                  onSortDirectionChange("desc");
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
  );
}

HeuristicHeaderComponent.displayName = "HeuristicHeader";
export const HeuristicHeader = memo(HeuristicHeaderComponent);
