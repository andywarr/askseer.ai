import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";

interface NoCreditsAlertProps {
  credits: number;
  canPurchaseCredits?: boolean;
}

export function NoCreditsAlert({
  credits,
  canPurchaseCredits,
}: NoCreditsAlertProps) {
  if (credits > 0) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className="mb-6 flex items-center gap-2 [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <AlertDescription>
        {canPurchaseCredits ? (
          <>
            The selected team has no credits.{" "}
            <Link href="/credits" className="font-medium underline">
              Purchase credits
            </Link>{" "}
            to run more studies.
          </>
        ) : (
          <>
            The selected team has no credits. Please contact your company or
            team admin to purchase more.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
