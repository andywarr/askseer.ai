"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface GalleryProps {
  presignedUrls: string[];
}

export default function Gallery({ presignedUrls }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="container mx-auto">
      <Carousel className="mx-auto w-full max-w-3xl">
        <CarouselContent>
          {presignedUrls.map((url: string, index: number) => (
            <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
              <div className="p-1 shadow">
                <Image
                  src={url}
                  alt={`Step ${index + 1} of ${presignedUrls.length} in the user flow`}
                  width={500} // Placeholder width
                  height={500} // Placeholder height
                  className="h-full w-full cursor-pointer rounded-lg object-cover transition-transform hover:scale-105"
                  onClick={() => setSelectedImage(url)}
                  priority={true}
                  unoptimized={true}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>

      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="max-w-4xl">
          {selectedImage && (
            <Image
              src={selectedImage}
              alt="Selected image"
              width={500} // Placeholder width
              height={500} // Placeholder height
              className="h-auto w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
