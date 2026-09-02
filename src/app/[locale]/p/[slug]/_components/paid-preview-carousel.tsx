"use client";

import Autoplay from "embla-carousel-autoplay";
import { useMemo } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { PaidPreviewImage } from "@/domain/portal/paid-preview";

function imagePresentationStyle(image: PaidPreviewImage) {
  return {
    backgroundColor:
      !image.backgroundColor || image.backgroundColor === "secondary"
        ? "var(--secondary)"
        : image.backgroundColor,
    padding: Math.min(Math.max(image.containerPadding ?? 0, 0), 10),
  };
}

type PaidPreviewCarouselProps = {
  images: PaidPreviewImage[];
  label: string;
};

export function PaidPreviewCarousel({
  images,
  label,
}: PaidPreviewCarouselProps) {
  const carouselImages =
    images.length > 1 && images.length < 6 ? [...images, ...images] : images;
  const autoplay = useMemo(
    () => Autoplay({ delay: 3000, stopOnInteraction: false }),
    [],
  );

  return (
    <Carousel
      aria-label={label}
      opts={{
        align: "start",
        containScroll: false,
        loop: true,
        slidesToScroll: 1,
      }}
      plugins={[autoplay]}
    >
      <CarouselContent>
        {carouselImages.map((image, index) => (
          <CarouselItem className="basis-1/3" key={`${image.src}-${index}`}>
            <div
              className="aspect-square overflow-hidden rounded-lg"
              style={imagePresentationStyle(image)}
            >
              {/* biome-ignore lint/performance/noImgElement: These URLs are server-generated preview derivatives. */}
              <img
                alt={image.alt}
                className="size-full select-none object-contain"
                draggable={false}
                src={image.src}
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious
        className="left-2 shadow-md disabled:opacity-70"
        variant="secondary"
      />
      <CarouselNext
        className="right-2 shadow-md disabled:opacity-70"
        variant="secondary"
      />
    </Carousel>
  );
}
