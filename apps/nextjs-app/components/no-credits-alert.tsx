"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";
import { Button } from "@/apps/nextjs-app/components/ui/button";

const SESSION_STORAGE_KEY = "noCreditsAlertDismissedTeamId";

interface NoCreditsAlertProps {
  credits: number;
  canPurchaseCredits?: boolean;
  teamId?: string | null;
}

export function NoCreditsAlert({
  credits,
  canPurchaseCredits,
  teamId,
}: NoCreditsAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const prevTeamIdRef = useRef<string | null | undefined>(teamId);

  // Check sessionStorage on mount and when team changes
  useEffect(() => {
    const currentTeamKey = teamId ?? "default";
    const dismissedTeamId = sessionStorage.getItem(SESSION_STORAGE_KEY);

    // If team changed, clear the dismissed state for the old team
    if (prevTeamIdRef.current !== teamId) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setIsDismissed(false);
      prevTeamIdRef.current = teamId;
    } else {
      // On mount or same team, check if this team was dismissed
      setIsDismissed(dismissedTeamId === currentTeamKey);
    }
  }, [teamId]);

  if (credits > 0) {
    return null;
  }

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, teamId ?? "default");
    setIsDismissed(true);
  };

  return (
    <Alert
      variant="destructive"
      className="mb-6 flex min-h-14 items-center justify-between gap-2 bg-red-50 [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <AlertDescription>
          {canPurchaseCredits
            ? "The selected team has no credits."
            : "The selected team has no credits. Please contact your company or team admin to purchase more."}
        </AlertDescription>
      </div>
      <div className="flex items-center gap-2">
        {canPurchaseCredits && (
          <Button
            asChild
            size="sm"
            className="shrink-0 text-black"
            variant="outline"
          >
            <Link href="/credits">Manage Credits</Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-red-600 hover:!bg-red-100 hover:text-red-800"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
