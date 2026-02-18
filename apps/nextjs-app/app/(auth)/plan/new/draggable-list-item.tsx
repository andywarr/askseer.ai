"use client";

import React, { useRef } from "react";
import type { Identifier } from "dnd-core";
import { DragSourceMonitor, DropTargetMonitor, useDrag, useDrop } from "react-dnd";
import { GripVertical, X } from "lucide-react";

interface DragItem {
  index: number;
  type: string;
}

interface DraggableListItemProps {
  /** Unique item type string for react-dnd (keeps drag groups separate) */
  itemType: string;
  index: number;
  /** Optional label shown before content, e.g. "RQ1", "H2" */
  label?: string;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onRemove: (index: number) => void;
  children: React.ReactNode;
}

export function DraggableListItem({
  itemType,
  index,
  label,
  onMove,
  onRemove,
  children,
}: DraggableListItemProps) {
  const ref = useRef<HTMLLIElement>(null);

  const [{ handlerId }, drop] = useDrop<
    DragItem,
    void,
    { handlerId: Identifier | null }
  >({
    accept: itemType,
    collect(monitor: DropTargetMonitor) {
      return { handlerId: monitor.getHandlerId() };
    },
    hover(item: DragItem) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: itemType,
    item: () => ({ index, type: itemType }),
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <li
      ref={ref}
      data-handler-id={handlerId}
      className={`group flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm transition-opacity dark:border-zinc-700 dark:bg-zinc-800/60 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-zinc-400 active:cursor-grabbing" />
      {label && (
        <span className="flex-shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <button
        type="button"
        aria-label="Remove"
        className="ml-auto flex-shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-900 dark:hover:text-zinc-100"
        onClick={() => onRemove(index)}
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
