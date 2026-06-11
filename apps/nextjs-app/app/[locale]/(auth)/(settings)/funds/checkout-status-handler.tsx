"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";

/**
 * Component that handles Stripe checkout success/cancel redirects
 * Verifies the session and ensures credits are added immediately
 */
export function CheckoutStatusHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasHandledRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations("FundsSettings.checkoutStatus");
  const locale = useLocale();

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

      const toastId = toast.loading(t("processingPayment"), {
        description: t("addingFundsToTeam"),
      });

      // Verify the session and add credits immediately
      fetch("/api/funds/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));

          if (res.ok && data.success) {
            toast.success(t("paymentSuccessful"), {
              id: toastId,
              description: t("amountAdded", {
                amount: new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: "USD",
                }).format(data.amountCents / 100),
              }),
              duration: 5000,
            });

            // Refresh to show updated balance
            router.refresh();
          } else {
            toast.warning(t("paymentProcessed"), {
              id: toastId,
              description: t("fundsAppearShortly"),
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
          toast.error(t("verificationFailed"), {
            id: toastId,
            description: t("refreshToSeeBalance"),
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

      toast.success(t("paymentSuccessful"), {
        description: t("fundsBeingAdded"),
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

      toast.info(t("paymentCancelled"), {
        description: t("tryAgainLater"),
        duration: 4000,
      });

      // Clean up URL parameter
      const newUrl = window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, t]);

  return null;
}
