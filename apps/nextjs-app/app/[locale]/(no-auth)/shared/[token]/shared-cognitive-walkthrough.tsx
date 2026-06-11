"use client";

import { useState } from "react";
import Image from "next/image";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/apps/nextjs-app/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { InfoCard } from "@/apps/nextjs-app/components/heuristics/info-card";
import { useTranslations } from "next-intl";

interface CognitiveWalkthroughStep {
  id: string;
  step: number;
  expected: boolean;
  fileId?: string;
  results: Array<{
    question: {
      question: string;
    };
    answer: string;
  }>;
  issues: Array<{
    id: string;
    issue: string;
    issueType: string;
    source: string;
    severity?: number;
    rating?: string;
    recommendations?: Array<{
      id: string;
      recommendation: string;
      source: string;
      rating?: string;
    }>;
  }>;
}

interface SharedCognitiveWalkthroughProps {
  walkthrough: {
    goal: string;
    user: string | null;
    context: string | null;
    persona?: {
      id: string;
      name: string;
    } | null;
    steps: CognitiveWalkthroughStep[];
  };
  presignedUrls: string[];
  files: Array<{
    id: string;
    key: string;
  }>;
  studyLocale?: string;
}

function SharedCognitiveWalkthroughStep({
  step,
  totalSteps,
  expected,
  results,
  issues,
  imageUrl,
  studyLocale,
}: {
  step: number;
  totalSteps: number;
  expected: boolean;
  results: any;
  issues: any[];
  imageUrl: string;
  studyLocale?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const t = useTranslations("WalkthroughDetail");

  return (
    <div className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between">
          <h4
            className={`scroll-m-20 text-xl font-semibold tracking-tight ${step > 1 && !expected ? "text-red-500" : ""}`}
          >
            {t("stepOfTotal", { step, totalSteps })}
          </h4>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="gap-2 pt-2">
          <div className="mb-4">
            <Image
              src={imageUrl}
              alt={t("stepAlt", { step })}
              width={500}
              height={500}
              priority={true}
              unoptimized={true}
              className="mx-auto mb-4 h-auto max-h-96 w-auto max-w-full border object-contain p-1 shadow-sm md:float-left md:mr-4 md:max-w-[50%]"
            />
            {step > 1 && (
              <div className="mt-4 mb-4 md:mt-0">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  {t("expectedQuestion")}
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {expected ? t("yes") : t("no")}
                </p>
              </div>
            )}
            {step < totalSteps && results && results[0] && (
              <div className="mb-4">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  {results[0].question.question}
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {results[0].answer}
                </p>
              </div>
            )}
            {step < totalSteps && results && results[1] && (
              <div className="mb-4">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  {results[1].question.question}
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {results[1].answer}
                </p>
              </div>
            )}
            {step < totalSteps && results && results[2] && (
              <div className="mb-4">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  {results[2].question.question}
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {results[2].answer}
                </p>
              </div>
            )}
            <div className="clear-both"></div>
          </div>

          {/* Issue types with their display names - read-only */}
          {[
            { type: "DISCOVERABILITY" },
            { type: "LEARNABILITY" },
            { type: "USABILITY" },
          ].map(({ type }, index, array) => {
            const filteredIssues = issues.filter(
              (issue: any) => issue.issueType === type,
            );

            return (
              <div key={type}>
                <div>
                  <h5 className="scroll-m-20 text-lg font-bold tracking-tight">
                    {t(`issues.${type}.title`)}
                  </h5>
                </div>
                <div>
                  {filteredIssues.map((issue: any) => (
                    <div key={issue.id} className="mb-6">
                      <InfoCard
                        id={issue.id}
                        studyType="cognitiveWalkthrough"
                        type="issue"
                        content={issue.issue}
                        source={issue.source}
                        severity={issue.severity}
                        rating={
                          issue.rating === "UP"
                            ? "up"
                            : issue.rating === "DOWN"
                              ? "down"
                              : null
                        }
                        canManage={false}
                        studyLocale={studyLocale}
                      />
                      {issue.recommendations &&
                        issue.recommendations.length > 0 && (
                          <div>
                            <div className="mb-2 scroll-m-20 text-base font-semibold tracking-tight">
                              {t("recommendations")}
                            </div>
                            <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {issue.recommendations.map((rec: any) => (
                                <InfoCard
                                  key={rec.id}
                                  id={rec.id}
                                  studyType="cognitiveWalkthrough"
                                  type="recommendation"
                                  content={rec.recommendation}
                                  source={rec.source}
                                  rating={
                                    rec.rating === "UP"
                                      ? "up"
                                      : rec.rating === "DOWN"
                                        ? "down"
                                        : null
                                  }
                                  canManage={false}
                                  studyLocale={studyLocale}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                  {filteredIssues.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      {t(`issues.${type}.empty`)}
                    </p>
                  )}
                </div>
                {index < array.length - 1 && <Separator className="my-4" />}
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
      <Separator className="my-4" />
    </div>
  );
}

export function SharedCognitiveWalkthrough({
  walkthrough,
  presignedUrls,
  files,
  studyLocale = "en",
}: SharedCognitiveWalkthroughProps) {
  const [hideNonIssue, setHideNonIssue] = useState(false);
  const t = useTranslations("WalkthroughDetail");

  const steps = walkthrough.steps || [];
  const totalSteps = steps.length;

  // Create a map from fileId to presigned URL
  const fileIdToUrl = new Map<string, string>();
  files.forEach((file, index) => {
    if (file.id && presignedUrls[index]) {
      fileIdToUrl.set(file.id, presignedUrls[index]);
    }
  });

  // Calculate issue count (unexpected steps)
  const issueCount = steps.filter((step) => step.expected === false).length;

  // Filter steps based on hideNonIssue toggle
  const filteredSteps = hideNonIssue
    ? steps.filter((step) => step.expected === false)
    : steps;

  return (
    <div className="mt-8">
      {/* Header */}
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
          <div className="flex items-center gap-2">
            <Switch
              checked={hideNonIssue}
              onCheckedChange={setHideNonIssue}
              aria-label={t("toggleNonIssue")}
            />
            <span className="text-sm text-zinc-500">
              {t("onlyShowUnexpected")}
            </span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="mb-4 flex flex-col">
        {filteredSteps.map((step, index) => {
          // Get the image URL for this step based on fileId or fall back to index
          const imageUrl = step.fileId
            ? fileIdToUrl.get(step.fileId) ||
              presignedUrls[steps.indexOf(step)] ||
              ""
            : presignedUrls[steps.indexOf(step)] || "";

          return (
            <SharedCognitiveWalkthroughStep
              key={step.id || index}
              step={step.step}
              totalSteps={totalSteps}
              expected={step.expected}
              results={step.results}
              issues={step.issues || []}
              imageUrl={imageUrl}
              studyLocale={studyLocale}
            />
          );
        })}
      </div>
    </div>
  );
}
