"use client";

import { useState, useEffect } from "react";
import { Building2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { ClaimCompanyDialog } from "@/apps/nextjs-app/components/layout/claim-company-dialog";

const LOCAL_STORAGE_KEY = "claimCompanyAlertDismissCount";
const SESSION_STORAGE_KEY = "claimCompanyAlertDismissedThisSession";
const MAX_DISMISS_COUNT = 3;

interface ClaimCompanyAlertProps {
  canClaimCompany: boolean;
  domain?: string | null;
}

export function ClaimCompanyAlert({ canClaimCompany, domain }: ClaimCompanyAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    // 1. User can claim a company
    // 2. Not already dismissed this session
    // 3. Total dismissals across all sessions is less than 3
    setShouldShow(
      canClaimCompany &&
        !dismissedThisSession &&
        totalDismissCount < MAX_DISMISS_COUNT,
    );
  }, [canClaimCompany]);

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
    <>
      <Alert className="mb-6 flex min-h-14 items-center justify-between gap-2 border-blue-200 bg-blue-50 [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Claim your company to manage teams and collaborate with colleagues.
          </AlertDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="shrink-0"
            variant="outline"
            onClick={() => setDialogOpen(true)}
          >
            Claim Company
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-blue-600 hover:!bg-blue-100 hover:text-blue-800"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
      <ClaimCompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="create"
        domain={domain}
      />
    </>
  );
}
