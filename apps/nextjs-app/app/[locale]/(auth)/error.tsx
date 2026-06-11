"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLogger.error("Page error", {
      error: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const handleGoBack = useCallback(() => {
    window.history.back();
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-parisienne mb-8 text-center text-7xl tracking-tight text-balance">
          Oops!
        </h1>
        <h2 className="mb-4 text-3xl font-semibold tracking-tight">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md leading-7">
          We encountered an unexpected error. Please try again later or contact
          support if the problem persists.
        </p>
        <div className="flex gap-4">
          <Button onClick={reset}>Try Again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go Home</Link>
          </Button>
          <Button variant="ghost" onClick={handleGoBack}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
