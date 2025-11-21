"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/apps/nextjs-app/components/ui/card";
import { Dialog, DialogContent } from "@/apps/nextjs-app/components/ui/dialog";

interface GalleryProps {
  presignedUrls: string[];
}

export default function Gallery({ presignedUrls }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const edgeFadeColor = "243, 244, 246"; // matches bg-gray-100 section
  const rightEdgeGradient = `linear-gradient(to right, rgba(${edgeFadeColor}, 1) 0%, rgba(${edgeFadeColor}, 0.6) 60%, rgba(${edgeFadeColor}, 0) 100%)`;
  const leftEdgeGradient = `linear-gradient(to left, rgba(${edgeFadeColor}, 1) 0%, rgba(${edgeFadeColor}, 0.6) 60%, rgba(${edgeFadeColor}, 0) 100%)`;

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
  }, [presignedUrls.length, updateScrollShadows]);

  useEffect(() => {
    const handleResize = () => updateScrollShadows();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateScrollShadows]);

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollShadows}
        className="flex gap-4 overflow-x-scroll pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        aria-label="Study images"
      >
        {presignedUrls.map((url: string, index: number) => (
          <button
            key={url + index}
            type="button"
            onClick={() => setSelectedImage(url)}
            className="group max-w-xs shrink-0"
          >
            <Card className="overflow-hidden p-0 shadow-sm transition-shadow group-hover:shadow-md">
              <div className="flex items-center justify-center bg-white">
                <img
                  src={url}
                  alt={`Step ${index + 1} of ${presignedUrls.length} in the user flow`}
                  className="h-auto max-h-48 w-auto max-w-full object-contain"
                />
              </div>
            </Card>
          </button>
        ))}
      </div>
      {showLeftShadow && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-12"
          style={{ background: rightEdgeGradient }}
        />
      )}
      {showRightShadow && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12"
          style={{ background: leftEdgeGradient }}
        />
      )}

      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="h-5/6 max-w-4xl border-none bg-transparent text-white shadow-none focus:outline-hidden [&>button]:hidden">
          {selectedImage && (
            <Image
              src={selectedImage}
              alt="Selected image"
              fill
              className="object-contain"
              priority={true}
              unoptimized={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
