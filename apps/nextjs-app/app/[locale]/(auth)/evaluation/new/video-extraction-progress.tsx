"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import type { ExtractionProgress } from "@/apps/nextjs-app/utils/video-frame-extractor";
import { useTranslations } from "next-intl";

interface VideoExtractionProgressProps {
  progress: ExtractionProgress;
}

/**
 * Displays progress indicator for video frame extraction.
 * Shows a loading spinner, message, and progress bar.
 */
export const VideoExtractionProgress = React.memo(
  function VideoExtractionProgress({ progress }: VideoExtractionProgressProps) {
    const t = useTranslations("SharedStudyComponents.videoExtraction");

    const getLocalizedMessage = () => {
      switch (progress.phase) {
        case "loading":
          return t("loadingVideo");
        case "extracting":
          if (progress.current === 0) {
            const match = progress.message.match(/Extracting frames from (\d+)s/);
            return t("extractingFramesFromVideo", { duration: match ? match[1] : "" });
          }
          return t("extractedFrameOf", { current: progress.current, total: progress.total });
        case "deduplicating":
          if (progress.current === 0) {
            return t("removingDuplicateFrames");
          }
          return t("comparingFrameOf", { current: progress.current, total: progress.total });
        case "complete":
          return t("extractedDistinctFrames", { count: progress.current });
        default:
          return progress.message;
      }
    };

    return (
      <div className="flex w-full flex-col items-center gap-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
        <div className="flex items-center gap-2">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm font-medium">
            {getLocalizedMessage()}
          </span>
        </div>
        {progress.total > 0 && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full bg-zinc-500 transition-all duration-200 dark:bg-zinc-400"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
    );
  },
);

VideoExtractionProgress.displayName = "VideoExtractionProgress";
