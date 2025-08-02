"use client";

import Link from "next/link";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console in development
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="mb-8 scroll-m-20 text-balance text-center font-parisienne text-7xl tracking-tight">
              Oops!
            </h1>
            <h2 className="mb-4 scroll-m-20 text-3xl font-semibold tracking-tight">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md leading-7">
              We encountered an unexpected error. Please try again later or contact
              support if the problem persists.
            </p>
            <div className="flex gap-4">
              <Button asChild>
                <Link href="/">Go Home</Link>
              </Button>
              <Button variant="outline" onClick={reset}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
