"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/apps/nextjs-app/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/apps/nextjs-app/components/ui/carousel";

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
              <div className="p-1">
                <Image
                  src={url}
                  alt={`Step ${index + 1} of ${presignedUrls.length} in the user flow`}
                  width={500} // Placeholder width
                  height={500} // Placeholder height
                  className="max-h-60 scale-95 cursor-pointer rounded-lg object-contain transition-transform hover:scale-100"
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
        <DialogContent className="h-5/6 max-w-4xl border-none bg-transparent text-white">
          {selectedImage && (
            <Image
              src={selectedImage}
              alt="Selected image"
              layout="fill"
              className="object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
