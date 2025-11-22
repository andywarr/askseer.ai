"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/apps/nextjs-app/components/ui/card";
import { Dialog, DialogContent } from "@/apps/nextjs-app/components/ui/dialog";

interface GalleryProps {
  presignedUrls: string[];
}

interface ImageDimensions {
  width: number;
  height: number;
}

export default function Gallery({ presignedUrls }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<
    Map<string, ImageDimensions>
  >(new Map());

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

  const handleImageLoad = useCallback(
    (url: string, event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      setImageDimensions((prev) => {
        const newMap = new Map(prev);
        newMap.set(url, {
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        return newMap;
      });
    },
    [],
  );

  const getCardDimensions = (
    url: string,
  ): { width: number; height: number } => {
    const dimensions = imageDimensions.get(url);
    if (!dimensions) return { width: 240, height: 180 }; // default fallback

    const targetArea = 240 * 180; // 43,200 sq px - consistent card area
    const aspectRatio = dimensions.width / dimensions.height;

    // Calculate dimensions that maintain the target area
    let height = Math.sqrt(targetArea / aspectRatio);
    let width = height * aspectRatio;

    // Apply constraints
    const maxWidth = 320;
    const maxHeight = 240;
    const minWidth = 160;
    const minHeight = 120;

    // Clamp dimensions
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    } else if (width < minWidth) {
      width = minWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    } else if (height < minHeight) {
      height = minHeight;
      width = height * aspectRatio;
    }

    return { width: Math.round(width), height: Math.round(height) };
  };

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollShadows}
        className="flex gap-4 overflow-x-scroll pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        aria-label="Study images"
      >
        {presignedUrls.map((url: string, index: number) => {
          const { width, height } = getCardDimensions(url);
          return (
            <button
              key={url + index}
              type="button"
              onClick={() => setSelectedImage(url)}
              className="group shrink-0"
            >
              <Card
                className="overflow-hidden p-0 shadow-sm transition-shadow group-hover:shadow-md"
                style={{ width: `${width}px` }}
              >
                <div className="relative" style={{ height: `${height}px` }}>
                  <Image
                    src={url}
                    alt={`Step ${index + 1} of ${presignedUrls.length} in the user flow`}
                    fill
                    className="object-cover"
                    unoptimized={true}
                    onLoad={(e) => handleImageLoad(url, e)}
                  />
                </div>
              </Card>
            </button>
          );
        })}
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
