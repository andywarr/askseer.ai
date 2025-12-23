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
}

function SharedCognitiveWalkthroughStep({
  step,
  totalSteps,
  expected,
  results,
  issues,
  imageUrl,
}: {
  step: number;
  totalSteps: number;
  expected: boolean;
  results: any;
  issues: any[];
  imageUrl: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between">
          <h4
            className={`scroll-m-20 text-xl font-semibold tracking-tight ${step > 1 && !expected ? "text-red-500" : ""}`}
          >
            Step {step} of {totalSteps}
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
              alt={`Step ${step} in the user flow`}
              width={500}
              height={500}
              priority={true}
              unoptimized={true}
              className="mx-auto mb-4 h-auto max-h-96 w-full border object-contain p-1 shadow-sm md:float-left md:mr-4 md:w-1/2"
            />
            {step > 1 && (
              <div className="mt-4 mb-4 md:mt-0">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  Is the user interface at this step what was expected?
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {expected ? "Yes" : "No"}
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
            { type: "DISCOVERABILITY", displayName: "Discoverability issues" },
            { type: "LEARNABILITY", displayName: "Learnability issues" },
            { type: "USABILITY", displayName: "Usability issues" },
          ].map(({ type, displayName }, index, array) => {
            const filteredIssues = issues.filter(
              (issue: any) => issue.issueType === type,
            );

            return (
              <div key={type}>
                <div>
                  <h5 className="scroll-m-20 text-lg font-bold tracking-tight">
                    {displayName}
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
                      />
                      {issue.recommendations &&
                        issue.recommendations.length > 0 && (
                          <div>
                            <div className="mb-2 scroll-m-20 text-base font-semibold tracking-tight">
                              Recommendations
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
                                />
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                  {filteredIssues.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      No {displayName.toLowerCase()} found.
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
}: SharedCognitiveWalkthroughProps) {
  const [hideNonIssue, setHideNonIssue] = useState(false);

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
          Results
        </h3>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
          <p
            className={`${issueCount > 0 ? "text-red-500" : ""} whitespace-nowrap`}
          >
            <span className="text-4xl">{issueCount}</span>
            <span>{` ${issueCount === 1 ? "unexpected step" : "unexpected steps"}`}</span>
          </p>
          <div className="flex items-center gap-2">
            <Switch
              checked={hideNonIssue}
              onCheckedChange={setHideNonIssue}
              aria-label="Toggle non-issue steps"
            />
            <span className="text-sm text-zinc-500">
              Only show unexpected steps
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
            />
          );
        })}
      </div>
    </div>
  );
}
