import { Switch } from "@/apps/nextjs-app/components/ui/switch";

interface CognitiveWalkthroughHeaderProps {
  issueCount: number;
  hideNonIssue: boolean;
  onToggleNonIssue: (checked: boolean) => void;
}

export function CognitiveWalkthroughHeader({
  issueCount,
  hideNonIssue,
  onToggleNonIssue,
}: CognitiveWalkthroughHeaderProps) {
  return (
    <div className="mb-4 flex flex-row">
      <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
        <p
          className={`${issueCount > 0 ? "text-red-500" : ""} whitespace-nowrap`}
        >
          <span className="text-4xl">{issueCount}</span>
          <span>{` ${issueCount === 1 ? "unexpected step" : "unexpected steps"}`}</span>
        </p>
        <div className="flex items-center gap-2">
          <Switch
            checked={hideNonIssue}
            onCheckedChange={onToggleNonIssue}
            aria-label="Toggle non-issue steps"
          />
          <span className="text-sm text-zinc-500">
            Only show unexpected steps
          </span>
        </div>
      </div>
    </div>
  );
}
