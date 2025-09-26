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

  const fileSizeInMb = (file.size / 1024 / 1024).toFixed(2);

  return (
    <div
      className={`${cards > 1 ? "cursor-move" : ""} w-[220px] shrink-0`}
      ref={ref}
      data-handler-id={handlerId}
    >
      <Card className="group relative flex h-full flex-col overflow-hidden">
        <div className="relative h-40 w-full">
          <Image
            src={URL.createObjectURL(file)}
            alt={file.name}
            fill
            className="h-full w-full object-cover"
            loading="lazy"
            sizes="(min-width: 768px) 220px, 70vw"
          />
        </div>
        <CardContent className="grid gap-1 p-4">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">{fileSizeInMb} MB</p>
        </CardContent>
        <Button
          className="absolute right-2 top-2 h-8 w-8 rounded-full bg-background/80 text-sm opacity-0 shadow-sm transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
          variant="ghost"
          size="icon"
          type="button"
          aria-label={`Remove ${file.name}`}
          onClick={(e) => {
            e.preventDefault();
            deleteCard(index);
          }}
        >
          ×
        </Button>
      </Card>
    </div>
  );
};

export default DraggableCard;
