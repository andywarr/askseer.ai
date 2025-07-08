"use client";

import { useState } from "react";
import { CognitiveWalkthroughStep } from "@/apps/nextjs-app/components/cognitive-walkthrough-step";

interface CognitiveWalkthroughResultsProps {
  initialSteps: any[];
  presignedUrls: string[];
  totalSteps: number;
}

export function CognitiveWalkthroughResults({
  initialSteps,
  presignedUrls,
  totalSteps,
}: CognitiveWalkthroughResultsProps) {
  const [steps, setSteps] = useState(initialSteps);

  const handleDeleteIssue = (stepIndex: number, issueId: string) => {
    setSteps((prevSteps) =>
      prevSteps.map((step, index) =>
        index === stepIndex
          ? {
              ...step,
              issues: step.issues.filter((issue: any) => issue.id !== issueId),
            }
          : step,
      ),
    );
  };

  return (
    <div className="mb-4 flex flex-col">
      {steps.map((step: any, index: number) => (
        <CognitiveWalkthroughStep
          key={index}
          step={step.step}
          totalSteps={totalSteps}
          expected={step.expected}
          results={step.results}
          issues={step.issues}
          imageUrl={presignedUrls[index]}
          onDeleteIssue={(issueId: string) => handleDeleteIssue(index, issueId)}
        />
      ))}
    </div>
  );
}
