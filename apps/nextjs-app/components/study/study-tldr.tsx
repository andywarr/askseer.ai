"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Loader2, Sparkles, ChevronDown, ChevronUp, Bot, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";
import { generateStudyTldr } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { getStudyTldrStatus } from "@/apps/nextjs-app/lib/db/data";

// ==========================================
// Types
// ==========================================

interface TakeawayRecommendation {
  id: string;
  sortOrder: number;
  text: string;
  source: string;
}

interface Takeaway {
  id: string;
  sortOrder: number;
  title: string;
  description: string;
  source: string;
  recommendations: TakeawayRecommendation[];
}

interface StudyTldrProps {
  studyId: string;
  userId: string;
  initialTldrStatus: string | null;
  initialTakeaways: Takeaway[];
  canManage: boolean;
}

// ==========================================
// Component
// ==========================================

export function StudyTldr({
  studyId,
  userId,
  initialTldrStatus,
  initialTakeaways,
  canManage,
}: StudyTldrProps) {
  const [tldrStatus, setTldrStatus] = useState(initialTldrStatus || "PENDING");
  const [takeaways, setTakeaways] = useState<Takeaway[]>(initialTakeaways);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isCompleted = tldrStatus === "COMPLETED" && takeaways.length > 0;
  const isGeneratingStatus = tldrStatus === "GENERATING";
  const isPending = tldrStatus === "PENDING" || tldrStatus === "FAILED";

  // Polling for GENERATING status
  const pollTldrStatus = useCallback(async () => {
    try {
      const data = await getStudyTldrStatus(studyId, userId);
      if (!data) return;

      setTldrStatus(data.tldrStatus);

      if (data.tldrStatus === "COMPLETED" && data.takeaways?.length > 0) {
        setTakeaways(data.takeaways);
        setIsGenerating(false);
        // Stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (data.tldrStatus === "FAILED") {
        setIsGenerating(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (error) {
      clientLogger.error("Failed to poll TLDR status", {
        error: error instanceof Error ? error.message : String(error),
        studyId,
      });
    }
  }, [studyId, userId]);

  useEffect(() => {
    if (isGeneratingStatus) {
      // Start polling every 15 seconds
      pollTldrStatus();
      intervalRef.current = setInterval(pollTldrStatus, 15000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isGeneratingStatus, pollTldrStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setTldrStatus("GENERATING");

    try {
      const result = await generateStudyTldr(studyId);
      if (!result.success) {
        toast.error(result.error || "Failed to generate TLDR");
        setTldrStatus("PENDING");
        setIsGenerating(false);
      }
      // On success, polling will pick up the status
    } catch (error) {
      clientLogger.error("Error generating TLDR", {
        error: error instanceof Error ? error.message : String(error),
        studyId,
      });
      toast.error("Failed to generate TLDR. Please try again.");
      setTldrStatus("PENDING");
      setIsGenerating(false);
    }
  };

  const toggleExpanded = (takeawayId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(takeawayId)) {
        next.delete(takeawayId);
      } else {
        next.add(takeawayId);
      }
      return next;
    });
  };

  // ==========================================
  // Render: Generating state
  // ==========================================
  if (isGeneratingStatus || isGenerating) {
    return (
      <div className="mb-8">
        <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
          Key Takeaways
        </h3>
        <div className="rounded-lg border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-4">
          <div className="flex items-center gap-3 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Generating takeaways…</span>
          </div>
          {/* Skeleton cards */}
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-md border border-zinc-100 bg-zinc-50 p-4"
              >
                <div className="mb-2 h-4 w-1/3 rounded bg-zinc-200" />
                <div className="h-3 w-2/3 rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render: Completed state with takeaways
  // ==========================================
  if (isCompleted) {
    return (
      <div className="mb-8">
        <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
          Key Takeaways
        </h3>
        <div className="rounded-lg border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-4">
          <div className="space-y-3">
            {takeaways
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((takeaway, index) => {
                const isExpanded = expandedCards.has(takeaway.id);
                const hasRecommendations =
                  takeaway.recommendations &&
                  takeaway.recommendations.length > 0;

                return (
                  <div
                    key={takeaway.id}
                    className="rounded-md border border-zinc-100 bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* Number badge */}
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold leading-snug text-zinc-900">
                          {takeaway.title}
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                          {takeaway.description}
                        </p>

                        {/* Recommendations toggle */}
                        {hasRecommendations && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleExpanded(takeaway.id)}
                              className="flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              {takeaway.recommendations.length} recommendation
                              {takeaway.recommendations.length !== 1
                                ? "s"
                                : ""}
                            </button>

                            {isExpanded && (
                              <ul className="mt-2 space-y-1.5 border-l-2 border-zinc-200 pl-3">
                                {takeaway.recommendations
                                  .sort((a, b) => a.sortOrder - b.sortOrder)
                                  .map((rec) => (
                                    <li
                                      key={rec.id}
                                      className="text-sm leading-relaxed text-zinc-600"
                                    >
                                      {rec.text}
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Bot className="h-3.5 w-3.5" />
              Generated by AI
            </span>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-zinc-500 hover:text-zinc-900"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                <RefreshCcw className="mr-1.5 h-3 w-3" />
                Regenerate
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render: Pending state — show generate button
  // ==========================================
  if (!canManage) return null; // Non-managers don't see the generate button

  return (
    <div className="mb-8">
      <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
        Key Takeaways
      </h3>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-500">
          Generate AI-powered takeaways highlighting the most important findings
          and actionable recommendations.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          className="cursor-pointer gap-1.5 whitespace-nowrap"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate
        </Button>
      </div>
    </div>
  );
}
