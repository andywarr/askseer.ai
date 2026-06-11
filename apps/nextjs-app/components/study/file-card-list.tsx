"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, AArrowDown, AArrowUp } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import DndProviderComponent from "@/apps/nextjs-app/components/dnd-provider";
import DraggableFileCard from "@/apps/nextjs-app/components/figma/draggable-file-card";
import { useTranslations } from "next-intl";

// Constants for scroll shadow gradients
const EDGE_FADE_COLOR = "255, 255, 255";
const RIGHT_EDGE_GRADIENT = `linear-gradient(to right, rgba(${EDGE_FADE_COLOR}, 1) 0%, rgba(${EDGE_FADE_COLOR}, 0.6) 60%, rgba(${EDGE_FADE_COLOR}, 0) 100%)`;
const LEFT_EDGE_GRADIENT = `linear-gradient(to left, rgba(${EDGE_FADE_COLOR}, 1) 0%, rgba(${EDGE_FADE_COLOR}, 0.6) 60%, rgba(${EDGE_FADE_COLOR}, 0) 100%)`;

interface FileCardListProps {
  files: File[];
  isLoading: boolean;
  isInteractionDisabled: boolean;
  sortDirection: "asc" | "desc";
  onSortToggle: () => void;
  onMoveCard: (dragIndex: number, hoverIndex: number) => void;
  onDeleteCard: (index: number) => void;
}

/**
 * Displays a horizontally scrollable list of file cards with drag-and-drop reordering.
 * Includes sort toggle button and scroll shadows.
 */
export const FileCardList = React.memo(function FileCardList({
  files,
  isLoading,
  isInteractionDisabled,
  sortDirection,
  onSortToggle,
  onMoveCard,
  onDeleteCard,
}: FileCardListProps) {
  const t = useTranslations("SharedStudyComponents.fileList");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const updateScrollShadows = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      setShowLeftShadow(false);
      setShowRightShadow(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const canScroll = scrollWidth - clientWidth > 1;

    setShowLeftShadow(canScroll && scrollLeft > 0);
    setShowRightShadow(canScroll && scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollShadows();
  }, [files, updateScrollShadows]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateScrollShadows();
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateScrollShadows]);

  const renderCard = useCallback(
    (file: File, index: number) => {
      return (
        <DraggableFileCard
          key={index}
          index={index}
          file={file}
          cards={files.length}
          moveCard={onMoveCard}
          deleteCard={onDeleteCard}
        />
      );
    },
    [files.length, onMoveCard, onDeleteCard],
  );

  if (files.length === 0 && !isLoading) {
    return null;
  }

  return (
    <DndProviderComponent>
      <div className="mt-4 overflow-hidden">
        {isLoading && (
          <div className="flex min-h-[70px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        )}
        <div className="relative overflow-hidden">
          {files.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onSortToggle}
              disabled={isInteractionDisabled}
              className="bg-background/80 absolute top-0 right-0 z-10 h-8 w-8 p-0 backdrop-blur-sm"
              aria-label={
                sortDirection === "asc" ? t("sortAscending") : t("sortDescending")
              }
            >
              {sortDirection === "asc" ? (
                <>
                  <AArrowUp aria-hidden className="h-4 w-4" />
                  <span className="sr-only">{t("sortAscending")}</span>
                </>
              ) : (
                <>
                  <AArrowDown aria-hidden className="h-4 w-4" />
                  <span className="sr-only">{t("sortDescending")}</span>
                </>
              )}
            </Button>
          )}
          <div
            ref={scrollContainerRef}
            onScroll={updateScrollShadows}
            className="flex gap-4 overflow-x-auto pr-10 pb-2"
          >
            {files.map((file, index) => {
              return renderCard(file, index);
            })}
          </div>
          {showLeftShadow && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-12"
              style={{ background: RIGHT_EDGE_GRADIENT }}
            />
          )}
          {showRightShadow && (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-12"
              style={{ background: LEFT_EDGE_GRADIENT }}
            />
          )}
        </div>
      </div>
    </DndProviderComponent>
  );
});

FileCardList.displayName = "FileCardList";
