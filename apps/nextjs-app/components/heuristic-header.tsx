interface HeuristicHeaderProps {
  violatedCount: number;
}

export function HeuristicHeader({
  violatedCount,
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
          <span className="text-4xl">{violatedCount}</span>
          <span>
            {` violated ${violatedCount === 1 ? "heuristic" : "heuristics"}`}
          </span>
        </p>
      </div>
    </div>
  );
}
