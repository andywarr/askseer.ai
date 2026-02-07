"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { FigmaConnectButton } from "@/apps/nextjs-app/components/figma/figma-connect-button";

interface FigmaImportSectionProps {
  figmaConnected: boolean;
  figmaUrl: string;
  figmaLoading: boolean;
  figmaError: string;
  isInteractionDisabled: boolean;
  onConnectionChange: (connected: boolean) => void;
  onUrlChange: (url: string) => void;
  onImport: () => void;
}

/**
 * Figma import section with OAuth connection button or URL input.
 * Shows appropriate UI based on connection status.
 */
export const FigmaImportSection = React.memo(function FigmaImportSection({
  figmaConnected,
  figmaUrl,
  figmaLoading,
  figmaError,
  isInteractionDisabled,
  onConnectionChange,
  onUrlChange,
  onImport,
}: FigmaImportSectionProps) {
  return (
    <>
      {figmaConnected ? (
        <div className="flex w-full gap-2">
          <Input
            type="text"
            placeholder="Enter a link to a Figma file or prototype"
            className="flex-1"
            value={figmaUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isInteractionDisabled}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onImport}
            disabled={isInteractionDisabled || !figmaUrl.trim()}
          >
            {figmaLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Import"
            )}
          </Button>
        </div>
      ) : (
        <FigmaConnectButton onConnectionChange={onConnectionChange} />
      )}
      {figmaError && (
        <p className="text-[0.8rem] font-medium text-red-500">{figmaError}</p>
      )}
    </>
  );
});

FigmaImportSection.displayName = "FigmaImportSection";
