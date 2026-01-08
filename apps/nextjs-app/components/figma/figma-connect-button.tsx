"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import { checkFigmaConnection } from "@/apps/nextjs-app/lib/figma/actions";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Figma icon component
const FigmaIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 24C10.208 24 12 22.208 12 20V16H8C5.792 16 4 17.792 4 20C4 22.208 5.792 24 8 24Z"
      fill="#0ACF83"
    />
    <path
      d="M4 12C4 9.792 5.792 8 8 8H12V16H8C5.792 16 4 14.208 4 12Z"
      fill="#A259FF"
    />
    <path
      d="M4 4C4 1.792 5.792 0 8 0H12V8H8C5.792 8 4 6.208 4 4Z"
      fill="#F24E1E"
    />
    <path
      d="M12 0H16C18.208 0 20 1.792 20 4C20 6.208 18.208 8 16 8H12V0Z"
      fill="#FF7262"
    />
    <path
      d="M20 12C20 14.208 18.208 16 16 16C13.792 16 12 14.208 12 12C12 9.792 13.792 8 16 8C18.208 8 20 9.792 20 12Z"
      fill="#1ABCFE"
    />
  </svg>
);

interface FigmaConnectButtonProps {
  onConnectionChange?: (connected: boolean) => void;
  returnUrl?: string;
  compact?: boolean;
  className?: string;
}

export function FigmaConnectButton({
  onConnectionChange,
  returnUrl,
  compact = false,
  className,
}: FigmaConnectButtonProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const searchParams = useSearchParams();

  // Check for OAuth callback results in URL
  useEffect(() => {
    const figmaConnected = searchParams.get("figma_connected");
    const figmaError = searchParams.get("figma_error");

    if (figmaConnected === "true") {
      toast.success("Figma account connected successfully!");
      // Remove the query params from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("figma_connected");
      window.history.replaceState({}, "", url.toString());
    } else if (figmaError) {
      const errorMessages: Record<string, string> = {
        access_denied: "You cancelled the Figma connection.",
        invalid_state:
          "Connection failed due to a security error. Please try again.",
        no_code: "Connection failed. Please try again.",
        callback_failed:
          "Failed to complete Figma connection. Please try again.",
      };
      toast.error(
        errorMessages[figmaError] || "Failed to connect Figma account.",
      );
      // Remove the query params from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("figma_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const connection = await checkFigmaConnection();
      setIsConnected(connection.connected);
      onConnectionChange?.(connection.connected);
    } catch (error) {
      console.error("Failed to check Figma connection:", error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Refetch when returning from OAuth flow
  useEffect(() => {
    const figmaConnected = searchParams.get("figma_connected");
    if (figmaConnected === "true") {
      fetchStatus();
    }
  }, [searchParams, fetchStatus]);

  const handleConnect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Build the authorization URL with return URL
    const currentUrl = returnUrl || window.location.pathname;
    const authorizeUrl = `/api/figma/authorize?returnUrl=${encodeURIComponent(currentUrl)}`;
    window.location.href = authorizeUrl;
  };

  const handleDisconnect = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsDisconnecting(true);
      const response = await fetch("/api/figma/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }

      setIsConnected(false);
      onConnectionChange?.(false);
      toast.success("Figma account disconnected.");
    } catch (error) {
      console.error("Failed to disconnect Figma:", error);
      toast.error("Failed to disconnect Figma account. Please try again.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Button type="button" variant="outline" disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {!compact && <span>Checking Figma...</span>}
      </Button>
    );
  }

  if (isConnected) {
    return (
      <div className={`flex items-center gap-2 ${className || ""}`}>
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-700">
          <FigmaIcon className="h-4 w-4" />
          <Check className="h-4 w-4" />
          {!compact && <span>Figma Connected</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="text-muted-foreground hover:text-destructive"
        >
          {isDisconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {!compact && <span>Disconnect</span>}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleConnect}
      className={className}
    >
      <FigmaIcon className="h-4 w-4" />
      {compact ? "Connect" : "Connect Figma"}
    </Button>
  );
}

export default FigmaConnectButton;
