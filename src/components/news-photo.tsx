"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";

export function NewsPhoto({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
  className = "h-auto w-full",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`View larger photo: ${alt}`}
        className="block w-full cursor-zoom-in bg-transparent p-0 text-left"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className={className}
          sizes={sizes}
        />
      </DialogTrigger>
      <DialogContent
        overlayClassName="bg-black/80"
        className="max-h-[92vh] w-[min(96vw,72rem)] max-w-[min(96vw,72rem)] overflow-hidden border border-white/10 bg-black p-2 sm:max-w-[min(96vw,72rem)]"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {/* The dialog shows the original file so the enlarged photo keeps its proportions. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="mx-auto h-auto max-h-[86vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
