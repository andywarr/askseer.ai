import { memo } from "react";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { useTranslations } from "next-intl";

interface CognitiveWalkthroughHeaderProps {
  issueCount: number;
  hideNonIssue: boolean;
  onToggleNonIssue: (checked: boolean) => void;
}

function CognitiveWalkthroughHeaderComponent({
  issueCount,
  hideNonIssue,
  onToggleNonIssue,
}: CognitiveWalkthroughHeaderProps) {
  const t = useTranslations("WalkthroughDetail");

  return (
    <div className="mb-4 flex flex-row items-baseline justify-between">
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        {t("results")}
      </h3>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
        <p
          className={`${issueCount > 0 ? "text-red-500" : ""} whitespace-nowrap`}
        >
          <span className="text-4xl">{issueCount}</span>
          <span>{` ${issueCount === 1 ? t("unexpectedStep") : t("unexpectedSteps")}`}</span>
        </p>
        <div className="flex items-center gap-2 print:hidden">
          <Switch
            checked={hideNonIssue}
            onCheckedChange={onToggleNonIssue}
            aria-label={t("toggleNonIssue")}
          />
          <span className="text-sm text-zinc-500">
            {t("onlyShowUnexpected")}
          </span>
        </div>
      </div>
    </div>
  );
}

CognitiveWalkthroughHeaderComponent.displayName = "CognitiveWalkthroughHeader";
export const CognitiveWalkthroughHeader = memo(
  CognitiveWalkthroughHeaderComponent,
);
