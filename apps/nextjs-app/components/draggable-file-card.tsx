"use client";

// React imports
import React, { useEffect, useState } from "react";
import type { Identifier } from "dnd-core";
import {
  DragSourceMonitor,
  DropTargetMonitor,
  useDrag,
  useDrop,
} from "react-dnd";
import { X } from "lucide-react";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Card, CardContent } from "@/apps/nextjs-app/components/ui/card";
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";

const ItemType = "card";

interface DraggableCardProps {
  index: number;
  file: File;
  cards: number;
  moveCard: (dragIndex: number, hoverIndex: number) => void;
  deleteCard: any; //TODO: Use the correct type
  isUploading?: boolean;
  s3Key?: string; // Optional S3 key for files already uploaded (e.g., Figma imports)
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

const DraggableCard: React.FC<DraggableCardProps> = ({
  file,
  cards,
  index,
  moveCard,
  deleteCard,
  isUploading = false,
  s3Key,
}) => {
  const ref = React.useRef(null);

  // Use useState to create and manage the object URL
  // This avoids issues with React Strict Mode double-mounting revoking URLs prematurely
  const [objectUrl, setObjectUrl] = useState<string>("");

  useEffect(() => {
    // If we have an S3 key (e.g., Figma import), fetch a presigned URL
    if (s3Key) {
      let isMounted = true;
      getPresignedUrls(s3Key)
        .then((url) => {
          if (isMounted && url) {
            setObjectUrl(url);
          }
        })
        .catch((error) => {
          console.error(
            "Failed to get presigned URL for S3 key:",
            s3Key,
            error,
          );
        });
      return () => {
        isMounted = false;
      };
    }

    // Otherwise, create an object URL from the file blob
    if (file.size > 0) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);

      // Clean up the object URL when the component unmounts or file changes
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file, s3Key]);

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

  // ${isDragging ? "opacity-50" : ""}

  return (
    <div
      className={`${cards > 1 ? "cursor-move" : ""} group relative w-64 min-w-[16rem] shrink-0`}
      ref={ref}
      data-handler-id={handlerId}
    >
      <Card className="h-full gap-0 overflow-hidden p-0 shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative h-44 w-full">
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
          {/* Upload indicator overlay */}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span className="text-xs font-medium text-white">
                  Uploading...
                </span>
              </div>
            </div>
          )}
        </div>
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
        title="Remove image"
        disabled={isUploading}
      >
        <X size={18} />
      </Button>
    </div>
  );
};

export default DraggableCard;
