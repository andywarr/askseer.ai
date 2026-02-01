import { memo } from "react";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import {
  calculateGrade,
  GRADE_THRESHOLDS,
} from "@/apps/nextjs-app/utils/grade-utils";

interface HeuristicHeaderProps {
  violatedCount: number;
  totalIssues: number;
  totalScreens: number;
  hideNonViolated: boolean;
  onToggleNonViolated: (checked: boolean) => void;
}

function HeuristicHeaderComponent({
  violatedCount,
  totalIssues,
  totalScreens,
  hideNonViolated,
  onToggleNonViolated,
}: HeuristicHeaderProps) {
  const gradeInfo = calculateGrade(totalIssues, totalScreens);

  return (
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
          <div className="flex items-center gap-2 print:hidden">
            <Switch
              checked={hideNonViolated}
              onCheckedChange={onToggleNonViolated}
              aria-label="Toggle non-violated heuristics"
            />
            <span className="text-sm text-zinc-500">Only show violated</span>
          </div>
        </div>
      </div>
    </div>
  );
}

HeuristicHeaderComponent.displayName = "HeuristicHeader";
export const HeuristicHeader = memo(HeuristicHeaderComponent);
