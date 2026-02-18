"use client";

// React imports
import React, { useEffect, useMemo, useState } from "react";
import type { Identifier } from "dnd-core";
import {
  DragSourceMonitor,
  DropTargetMonitor,
  useDrag,
  useDrop,
} from "react-dnd";
import { FileText, Film, Mic, File, X } from "lucide-react";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Card, CardContent } from "@/apps/nextjs-app/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";

const ItemType = "card";

interface DraggableCardProps {
  index: number;
  file: File;
  cards: number;
  moveCard: (dragIndex: number, hoverIndex: number) => void;
  deleteCard: any; //TODO: Use the correct type
}

interface DragItem {
  index: number;
}

const KB = 1024;
const MB = KB * KB;

const formatFileSize = (sizeInBytes: number) => {
  if (sizeInBytes >= MB) {
    return `${new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(sizeInBytes / MB)} MB`;
  }

  if (sizeInBytes >= KB) {
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(sizeInBytes / KB)} KB`;
  }

  return `${sizeInBytes} B`;
};

/** Determine the broad category from a MIME type */
function getFileCategory(
  mimeType: string,
): "image" | "audio" | "video" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

/** Extract a short extension label from a filename */
function getExtension(name: string): string {
  const parts = name.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toUpperCase();
}

/** Icon + accent colour for each category */
const categoryConfig = {
  audio: {
    Icon: Mic,
    bgClass: "bg-violet-100 dark:bg-violet-900/40",
    iconClass: "text-violet-500 dark:text-violet-400",
  },
  video: {
    Icon: Film,
    bgClass: "bg-sky-100 dark:bg-sky-900/40",
    iconClass: "text-sky-500 dark:text-sky-400",
  },
  document: {
    Icon: FileText,
    bgClass: "bg-amber-100 dark:bg-amber-900/40",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  // fallback – should never be needed since images get the img branch
  image: {
    Icon: File,
    bgClass: "bg-zinc-100 dark:bg-zinc-800",
    iconClass: "text-zinc-400",
  },
} as const;

const DraggableCard: React.FC<DraggableCardProps> = ({
  file,
  cards,
  index,
  moveCard,
  deleteCard,
}) => {
  const ref = React.useRef(null);

  const category = useMemo(() => getFileCategory(file.type), [file.type]);
  const extension = useMemo(() => getExtension(file.name), [file.name]);
  const isImage = category === "image";

  // Use useState to create and manage the object URL
  // This avoids issues with React Strict Mode double-mounting revoking URLs prematurely
  const [objectUrl, setObjectUrl] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    // Clean up the object URL when the component unmounts or file changes
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const [{ handlerId }, drop] = useDrop<
    DragItem,
    void,
    { handlerId: Identifier | null }
  >({
    accept: ItemType,
    collect(monitor: DropTargetMonitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Time to actually perform the action
      moveCard(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: () => {
      return { index };
    },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  // Render the thumbnail / preview area based on file type
  const renderPreview = () => {
    if (isImage) {
      return (
        <button
          type="button"
          className="relative h-44 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
          onClick={(e) => {
            e.stopPropagation();
            setIsPreviewOpen(true);
          }}
          aria-label={`Preview ${file.name}`}
        >
          {/* Using native img element for blob URLs - next/image doesn't support blob URLs properly */}
          {objectUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={objectUrl}
              alt={file.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </button>
      );
    }

    // Non-image: show a styled icon area
    const { Icon, bgClass, iconClass } = categoryConfig[category];
    return (
      <div
        className={`flex h-44 w-full flex-col items-center justify-center gap-2 ${bgClass}`}
      >
        <Icon className={`h-12 w-12 ${iconClass}`} strokeWidth={1.5} />
        {extension && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${iconClass} bg-white/60 dark:bg-white/10`}
          >
            {extension}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`${cards > 1 ? "cursor-move" : ""} group relative w-64 min-w-[16rem] shrink-0`}
      ref={ref}
      data-handler-id={handlerId}
    >
      <Card className="h-full gap-0 overflow-hidden p-0 shadow-sm transition-shadow group-hover:shadow-md">
        {renderPreview()}
        <CardContent className="min-w-0 space-y-1 p-3">
          <div className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </div>
          <div className="text-xs text-zinc-500">
            {formatFileSize(file.size)}
          </div>
        </CardContent>
      </Card>
      <Button
        className="pointer-events-none absolute top-2 right-2 h-8 w-8 p-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:brightness-95 focus-visible:pointer-events-auto focus-visible:opacity-100"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          deleteCard(index);
        }}
        aria-label={`Remove ${file.name}`}
        title="Remove file"
      >
        <X size={18} />
      </Button>

      {/* Image Preview Dialog — only for actual images */}
      {isImage && (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent
            showCloseButton={false}
            className="!w-fit !max-w-[90vw] border-none bg-transparent p-0 shadow-none focus:outline-hidden [&>img]:block"
          >
            <DialogTitle className="sr-only">
              Image Preview: {file.name}
            </DialogTitle>
            {objectUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt={file.name}
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default DraggableCard;

