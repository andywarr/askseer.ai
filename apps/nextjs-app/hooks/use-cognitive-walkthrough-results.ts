import { useState, useCallback } from "react";
import { getCognitiveWalkthrough } from "@/apps/nextjs-app/lib/db/data";

export function useCognitiveWalkthroughResults(
  initialSteps: any[],
  studyId: string,
  userId: string,
) {
  const [steps, setSteps] = useState(initialSteps);

  const refreshResults = useCallback(async () => {
    const study = await getCognitiveWalkthrough(studyId, userId);
    if (!study || !study.cognitiveWalkthrough) {
      throw new Error("Failed to fetch updated data");
    }

    // The data is already structured correctly as steps with issues and results
    const updatedSteps = study.cognitiveWalkthrough.steps;

    // Sort steps by step number
    updatedSteps.sort((a: any, b: any) => a.step - b.step);

    // Sort results within each step by question number
    updatedSteps.forEach((step: any) => {
      step.results.sort((a: any, b: any) => {
        if (a.question && b.question) {
          return a.question.questionNumber - b.question.questionNumber;
        }
        return 0;
      });

      // Sort issues and their recommendations
      step.issues.sort((a: any, b: any) => a.id.localeCompare(b.id));
      step.issues.forEach((issue: any) => {
        if (issue.recommendations && Array.isArray(issue.recommendations)) {
          issue.recommendations.sort((a: any, b: any) =>
            a.id.localeCompare(b.id),
          );
        }
      });
    });

    setSteps(updatedSteps);
  }, [studyId, userId]);

  const deleteIssue = useCallback((issueId: string) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => ({
        ...step,
        issues: step.issues.filter((issue: any) => issue.id !== issueId),
      })),
    );
  }, []);

  const deleteRecommendation = useCallback(
    (issueId: string, recommendationId: string) => {
      setSteps((prevSteps) =>
        prevSteps.map((step) => ({
          ...step,
          issues: step.issues.map((issue: any) =>
            issue.id === issueId
              ? {
                  ...issue,
                  recommendations: issue.recommendations.filter(
                    (rec: any) => rec.id !== recommendationId,
                  ),
                }
              : issue,
          ),
        })),
      );
    },
    [],
  );

  return {
    steps,
    refreshResults,
    deleteIssue,
    deleteRecommendation,
    setSteps,
  };
}
