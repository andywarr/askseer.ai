"use client";

// Next imports
import Image from "next/image";

// React imports
import React from "react";
import type { Identifier } from "dnd-core";
import {
  DragSourceMonitor,
  DropTargetMonitor,
  useDrag,
  useDrop,
} from "react-dnd";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Card, CardContent } from "@/apps/nextjs-app/components/ui/card";

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

const formatFileSize = (sizeInBytes: number) => {
  if (sizeInBytes >= 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeInBytes >= 1024) {
    return `${Math.round(sizeInBytes / 1024)} KB`;
  }

  return `${sizeInBytes} B`;
};

const DraggableCard: React.FC<DraggableCardProps> = ({
  file,
  cards,
  index,
  moveCard,
  deleteCard,
}) => {
  const ref = React.useRef(null);

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
      <Card className="h-full overflow-hidden p-0 shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative h-44 w-full">
          <Image
            src={URL.createObjectURL(file)}
            alt={file.name}
            fill
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <CardContent className="flex flex-col gap-2 p-3">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        </CardContent>
      </Card>
      <Button
        className="absolute right-2 top-2 h-8 w-8 rounded-full p-0 opacity-0 transition-opacity hover:brightness-95 focus-visible:brightness-95 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          deleteCard(index);
        }}
        aria-label={`Remove ${file.name}`}
        title="Remove image"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="18px"
          viewBox="0 -960 960 960"
          width="18px"
          fill="currentColor"
        >
          <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
        </svg>
      </Button>
    </div>
  );
};

export default DraggableCard;
