"use client";

import { useState, useEffect } from "react";
import { Figma, X } from "lucide-react";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";
import { Button } from "@/apps/nextjs-app/components/ui/button";

const LOCAL_STORAGE_KEY = "addToFigmaAlertDismissCount";
const SESSION_STORAGE_KEY = "addToFigmaAlertDismissedThisSession";
const MAX_DISMISS_COUNT = 3;

interface AddToFigmaAlertProps {
  hasFigmaFiles: boolean;
  onAddToFigma: () => void;
}

export function AddToFigmaAlert({
  hasFigmaFiles,
  onAddToFigma,
}: AddToFigmaAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session
    const dismissedThisSession =
      sessionStorage.getItem(SESSION_STORAGE_KEY) === "true";

    // Check total dismiss count across all sessions
    const totalDismissCount = parseInt(
      localStorage.getItem(LOCAL_STORAGE_KEY) || "0",
      10,
    );

    // Only show if:
    // 1. Study has Figma-imported files
    // 2. Not already dismissed this session
    // 3. Total dismissals across all sessions is less than 3
    setShouldShow(
      hasFigmaFiles &&
        !dismissedThisSession &&
        totalDismissCount < MAX_DISMISS_COUNT,
    );
  }, [hasFigmaFiles]);

  const handleDismiss = () => {
    // Mark as dismissed for this session
    sessionStorage.setItem(SESSION_STORAGE_KEY, "true");

    // Increment total dismiss count in localStorage
    const currentCount = parseInt(
      localStorage.getItem(LOCAL_STORAGE_KEY) || "0",
      10,
    );
    localStorage.setItem(LOCAL_STORAGE_KEY, String(currentCount + 1));

    setIsDismissed(true);
  };

  if (!shouldShow || isDismissed) {
    return null;
  }

  return (
    <Alert className="mb-4 flex min-h-14 items-center justify-between gap-2 border-purple-200 bg-purple-50 print:hidden [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0">
      <div className="flex items-center gap-2">
        <Figma className="h-4 w-4 shrink-0 text-purple-600" />
        <AlertDescription className="text-purple-800">
          Add these results as comments directly to your Figma file.
        </AlertDescription>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="shrink-0"
          variant="outline"
          onClick={onAddToFigma}
        >
          Add to Figma
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-purple-600 hover:!bg-purple-100 hover:text-purple-800"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
