"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Component that handles Stripe checkout success/cancel redirects
 * Verifies the session and ensures credits are added immediately
 */
export function CheckoutStatusHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasHandledRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup function to clear any running poll interval
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Prevent double handling in strict mode
    if (hasHandledRef.current) return;

    const status = searchParams.get("status");
    const sessionId = searchParams.get("session_id");

    if (status === "success" && sessionId) {
      hasHandledRef.current = true;

      const toastId = toast.loading("Processing your payment...", {
        description: "Adding credits to your team",
      });

      // Verify the session and add credits immediately
      fetch("/api/credits/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));

          if (res.ok && data.success) {
            toast.success("Payment successful!", {
              id: toastId,
              description: `${data.credits} credits have been added to your team`,
              duration: 5000,
            });

            // Refresh to show updated balance
            router.refresh();
          } else {
            toast.warning("Payment processed", {
              id: toastId,
              description:
                "Your credits should appear shortly. Refresh if needed.",
              duration: 5000,
            });

            // Poll for updates as fallback
            let pollCount = 0;
            pollIntervalRef.current = setInterval(() => {
              pollCount++;
              router.refresh();
              if (pollCount >= 5) {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
              }
            }, 2000);
          }
        })
        .catch((error) => {
          console.error("Failed to verify session:", error);
          toast.error("Verification failed", {
            id: toastId,
            description: "Please refresh the page to see your credits",
            duration: 5000,
          });
        })
        .finally(() => {
          // Clean up URL parameters
          const newUrl = window.location.pathname;
          router.replace(newUrl);
        });
    } else if (status === "success" && !sessionId) {
      // Fallback for old-style redirect without session_id
      hasHandledRef.current = true;

      toast.success("Payment successful!", {
        description: "Your credits are being added...",
        duration: 5000,
      });

      // Clean up URL and refresh
      const newUrl = window.location.pathname;
      router.replace(newUrl);

      // Poll for updates
      let pollCount = 0;
      pollIntervalRef.current = setInterval(() => {
        pollCount++;
        router.refresh();
        if (pollCount >= 5) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }, 2000);
    } else if (status === "cancelled") {
      hasHandledRef.current = true;

      toast.info("Payment cancelled", {
        description: "You can try again whenever you're ready.",
        duration: 4000,
      });

      // Clean up URL parameter
      const newUrl = window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  return null;
}
