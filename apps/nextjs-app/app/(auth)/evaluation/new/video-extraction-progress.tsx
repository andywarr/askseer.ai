"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import type { ExtractionProgress } from "@/apps/nextjs-app/utils/video-frame-extractor";

interface VideoExtractionProgressProps {
  progress: ExtractionProgress;
}

/**
 * Displays progress indicator for video frame extraction.
 * Shows a loading spinner, message, and progress bar.
 */
export const VideoExtractionProgress = React.memo(
  function VideoExtractionProgress({ progress }: VideoExtractionProgressProps) {
    return (
      <div className="flex w-full flex-col items-center gap-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
        <div className="flex items-center gap-2">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm font-medium">
            {progress.message}
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
