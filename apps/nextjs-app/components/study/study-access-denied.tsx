import Link from "next/link";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Lock, ArrowLeft, Home } from "lucide-react";

type StudyAccessDeniedProps = {
  studyType?: "evaluation" | "persona" | "walkthrough" | "study";
};

export function StudyAccessDenied({
  studyType = "study",
}: StudyAccessDeniedProps) {
  const typeLabel = {
    evaluation: "heuristic evaluation",
    persona: "persona",
    walkthrough: "cognitive walkthrough",
    study: "study",
  }[studyType];

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto max-w-md">
        <div className="bg-muted mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
          <Lock className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="text-foreground text-2xl font-semibold">
          Access denied
        </h2>
        <p className="text-muted-foreground mt-4">
          You don&apos;t have permission to view this {typeLabel}. The study
          owner or an admin may have changed the sharing settings.
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          If you believe you should have access, please contact the study owner
          or your team administrator.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/studies">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to studies
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
