"use client";

// React imports
import { useState, useEffect, useRef } from "react";

// Next imports
import Link from "next/link";
import { useRouter } from "next/navigation";

// Lib function imports
import { retryStudy } from "@/apps/nextjs-app/lib/action";
import { getStudyStatus } from "@/apps/nextjs-app/lib/data";

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
  userId: string;
  canManage?: boolean;
  canView?: boolean;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<StudyStatus>(props.status);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryingRef = useRef(false);

  const canManage = props.canManage ?? true;
  const canView = props.canView ?? true;

  const isPending = currentStatus === StudyStatus.PENDING;
  const isFailed = currentStatus === StudyStatus.FAILED;
  const isCompleted = currentStatus === StudyStatus.COMPLETED;

  const isCognitiveWalkthrough = props.type === StudyType.COGNITIVE_WALKTHROUGH;
  const isHeuristicEvaluation = props.type === StudyType.HEURISTIC_EVALUATION;
  const isPersona = props.type === StudyType.PERSONA;

  // Polling effect for pending studies
  useEffect(() => {
    if (isPending && canManage) {
      const pollStatus = async () => {
        try {
          const { status } = await getStudyStatus(props.id, props.userId);
          setCurrentStatus(status);

          // When the study completes, stop polling and refresh the current route
          if (status === StudyStatus.COMPLETED) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            router.refresh();
          }
        } catch (error) {
          console.error("Failed to poll study status:", error);
        }
      };

      // Start polling every 15 seconds
      // Run an immediate poll first to pick up fresh state
      pollStatus();
      intervalRef.current = setInterval(pollStatus, 15000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [canManage, isPending, props.id, props.userId, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  async function handleRetryOnclick() {
    if (!canManage) return;
    if (retryingRef.current) return;
    retryingRef.current = true;
    // Optimistically set to pending and (re)start polling
    setCurrentStatus(StudyStatus.PENDING);
    try {
      // Clear any existing poller to avoid duplicates
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const res = await retryStudy(props.id);
      if (!res?.success) {
        // If retry failed, flip back to failed
        setCurrentStatus(StudyStatus.FAILED);
      }
    } catch (e) {
      console.error("Retry failed", e);
      setCurrentStatus(StudyStatus.FAILED);
    } finally {
      retryingRef.current = false;
    }
  }

  if (isPending) {
    return (
      <Button disabled variant="outline">
        <Loader2 className="animate-spin" />
        {isPersona ? "Creating" : "Analyzing"}
      </Button>
    );
  } else if (isFailed) {
    if (!canManage) {
      return (
        <Button variant="outline" disabled>
          Failed
        </Button>
      );
    }
    return (
      <div className="flex flex-col items-start">
        <Button
          onClick={handleRetryOnclick}
          variant="outline"
          disabled={retryingRef.current}
        >
          Retry
        </Button>
        <small className="mt-2 text-sm leading-none text-red-500">
          Something went wrong. Your credit has been refunded. Select
          &apos;Retry&apos; to try again for free.
        </small>
      </div>
    );
  } else if (isCompleted) {
    // Route to the appropriate results page for each study type
    const href = isHeuristicEvaluation
      ? `evaluation/${props.id}`
      : isPersona
        ? `persona/${props.id}`
        : isCognitiveWalkthrough
          ? `walkthrough/${props.id}`
          : null;

    if (href) {
      if (!canView) {
        return (
          <Button variant="outline" disabled>
            View
          </Button>
        );
      }
      return (
        <Link href={href}>
          <Button variant="outline">View</Button>
        </Link>
      );
    }

    return (
      <Button variant="outline" disabled>
        View
      </Button>
    );
  }
}
