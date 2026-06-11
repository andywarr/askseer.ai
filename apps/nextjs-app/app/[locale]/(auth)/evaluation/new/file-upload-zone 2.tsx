"use client";

import React from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";

interface FileUploadZoneProps {
  isInteractionDisabled: boolean;
  onUploadClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

/**
 * Drag-and-drop file upload zone with upload button.
 * Renders children (video progress, figma section, etc.) inside the drop zone.
 */
export const FileUploadZone = React.memo(function FileUploadZone({
  isInteractionDisabled,
  onUploadClick,
  onDrag,
  onDrop,
  children,
}: FileUploadZoneProps) {
  return (
    <div
      onDragOver={onDrag}
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDrop={onDrop}
      aria-disabled={isInteractionDisabled}
      className={`border-blue-gray-300 flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-4 ${isInteractionDisabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className="mx-auto h-4 w-4"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
        ></path>
      </svg>
      <Button
        variant="outline"
        onClick={onUploadClick}
        disabled={isInteractionDisabled}
      >
        Upload
      </Button>
      <p className="text-muted-foreground text-sm">
        Supported formats: .png, .jpg, .mp4, .webm, .mov
      </p>
      {children}
    </div>
  );
});

FileUploadZone.displayName = "FileUploadZone";
