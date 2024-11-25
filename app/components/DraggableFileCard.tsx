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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

  return (
    <div
      className={`${cards > 1 ? "cursor-move" : ""} max-w-[400px]`}
      ref={ref}
      data-handler-id={handlerId}
    >
      <Card className="flex flex-row">
        <CardHeader className="relative m-0 flex w-2/5 shrink-0 rounded-r-none">
          <Image
            src={URL.createObjectURL(file)}
            alt={file.name}
            fill
            className="h-full w-full object-cover object-left-top"
            loading="lazy"
          />
        </CardHeader>
        <CardContent className="flex w-full flex-row p-2">
          <div>
            <p className="leading-7 [&:not(:first-child)]:mt-6">{file.name}</p>
            <small className="text-sm font-medium leading-none text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </small>
          </div>
          <Button
            className="ml-auto h-fit w-fit p-2"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              deleteCard(index);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="currentColor"
            >
              <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
            </svg>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DraggableCard;
