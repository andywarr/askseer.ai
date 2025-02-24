"use client";

// Next imports
import Link from "next/link";

// Lib function imports
import { retryStudy } from "@/apps/nextjs-app/lib/action";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

// Prisma imports
import { StudyStatus, StudyType } from "@prisma/client";

// Other imports
import { Loader2 } from "lucide-react";

export function StudyButton(props: {
  id: string;
  status: StudyStatus;
  type: StudyType;
}) {
  const isPending = props.status === StudyStatus.PENDING;
  const isFailed = props.status === StudyStatus.FAILED;
  const isCompleted = props.status === StudyStatus.COMPLETED;
  const isCognitiveWalkthrough = props.type === StudyType.COGNITIVE_WALKTHROUGH;
  const isHeuristicEvaluation = props.type === StudyType.HEURISTIC_EVALUATION;

  async function handleRetryOnclick() {
    await retryStudy(props.id);
  }

  if (isPending) {
    return (
      <Button disabled variant="outline">
        <Loader2 className="animate-spin" />
        Analyzing
      </Button>
    );
  } else if (isFailed) {
    return (
      <div className="flex flex-col items-start">
        <Button onClick={handleRetryOnclick} variant="outline">
          Retry
        </Button>
        <small className="mt-2 text-sm leading-none text-red-500">
          Something went wrong. Your credit has been refunded. Select
          &apos;Retry&apos; to try again for free.
        </small>
      </div>
    );
  } else if (isCompleted) {
    const href = isCognitiveWalkthrough
      ? `walkthrough/${props.id}`
      : `heuristic/${props.id}`;
    return (
      <Link href={href}>
        <Button variant="outline">View results</Button>
      </Link>
    );
  }
}
