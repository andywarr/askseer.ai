"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Hook to check if the user's session is still valid before performing actions.
 * This helps catch expired sessions on the client side before making server calls.
 *
 * Usage:
 * ```
 * const { checkSession } = useSessionCheck();
 *
 * const handleSubmit = async () => {
 *   if (!await checkSession()) return;
 *   // proceed with form submission
 * };
 * ```
 */
export function useSessionCheck() {
  const router = useRouter();

  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        toast.error("Your session has expired", {
          description: "Please sign in again to continue.",
        });
        router.push("/");
        return false;
      }

      const session = await response.json();

      // Check if session has user data
      if (!session?.user?.id) {
        toast.error("Your session has expired", {
          description: "Please sign in again to continue.",
        });
        router.push("/");
        return false;
      }

      return true;
    } catch (error) {
      // Network error or other issue - let the server action handle it
      // but log for debugging
      console.warn("Session check failed:", error);
      return true; // Let the request proceed, server will handle auth
    }
  }, [router]);

  return { checkSession };
}
