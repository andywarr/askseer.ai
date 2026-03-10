"use client";

import React from "react";
import { Upload } from "lucide-react";

interface FileUploadZoneProps {
  isInteractionDisabled: boolean;
  onUploadClick: (e: React.MouseEvent) => void;
  onDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Click-to-upload drop zone for file uploads.
 * The entire zone is clickable to trigger the file input.
 * Renders children (video progress, figma section, etc.) inside the drop zone.
 */
export const FileUploadZone = React.memo(function FileUploadZone({
  isInteractionDisabled,
  onUploadClick,
  onDrag,
  onDrop,
  children,
  className,
}: FileUploadZoneProps) {
  return (
    <div
      onDragOver={onDrag}
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDrop={onDrop}
      aria-disabled={isInteractionDisabled}
      onClick={(e) => {
        // Don't trigger file picker if user clicked on an interactive child
        // (e.g. Figma URL input, buttons inside children)
        const target = e.target as HTMLElement;
        if (
          target.closest("input") ||
          target.closest("button") ||
          target.closest("a") ||
          target.closest("[role='button']")
        ) {
          return;
        }
        if (!isInteractionDisabled) {
          onUploadClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      className={`border-blue-gray-300 flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 transition-colors ${isInteractionDisabled ? "pointer-events-none opacity-50" : "cursor-pointer"} ${className ?? ""}`}
    >
      <Upload className="text-muted-foreground h-6 w-6" />
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-medium">
          Drop files or click to upload
        </span>
        <span className="text-muted-foreground text-xs">
          Supported formats: .png, .jpg, .mp4, .webm, .mov
        </span>
      </div>
      {children}
    </div>
  );
});

FileUploadZone.displayName = "FileUploadZone";
