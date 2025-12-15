import { Switch } from "@/apps/nextjs-app/components/ui/switch";

interface HeuristicHeaderProps {
  violatedCount: number;
  totalIssues: number;
  hideNonViolated: boolean;
  onToggleNonViolated: (checked: boolean) => void;
}

export function HeuristicHeader({
  violatedCount,
  totalIssues,
  hideNonViolated,
  onToggleNonViolated,
}: HeuristicHeaderProps) {
  return (
    <div className="mb-4 flex flex-row items-baseline justify-between">
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Results
      </h3>
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-baseline sm:gap-4">
        <p
          className={`${violatedCount > 0 ? "text-red-500" : ""} whitespace-nowrap`}
        >
          <span className="text-4xl text-zinc-500">{totalIssues}</span>
          <span className="pr-4 text-zinc-500">
            {totalIssues === 1 ? " issue" : " issues"}
          </span>
          <span className="text-4xl">{violatedCount}</span>
          <span>{` ${violatedCount === 1 ? "violation" : "violations"}`}</span>
        </p>
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
  );
}
