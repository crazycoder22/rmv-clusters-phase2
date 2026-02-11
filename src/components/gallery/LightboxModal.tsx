"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { GalleryImage } from "@/types";

interface LightboxModalProps {
  images: GalleryImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function LightboxModal({
  images,
  currentIndex,
  onClose,
  onNavigate,
}: LightboxModalProps) {
  const current = images[currentIndex];

  const handlePrev = useCallback(() => {
    onNavigate(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  }, [currentIndex, images.length, onNavigate]);

  const handleNext = useCallback(() => {
    onNavigate(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, images.length, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, handlePrev, handleNext]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white z-10 p-2"
        aria-label="Close"
      >
        <X size={28} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handlePrev();
        }}
        className="absolute left-4 text-white/80 hover:text-white z-10 p-2"
        aria-label="Previous image"
      >
        <ChevronLeft size={36} />
      </button>

      <div
        className="relative max-w-5xl max-h-[85vh] w-full mx-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-[85vh]">
          <Image
            src={current.src}
            alt={current.alt}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </div>
        {current.caption && (
          <p className="text-center text-white/80 mt-4 text-sm">
            {current.caption} &middot; {currentIndex + 1} of {images.length}
          </p>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        className="absolute right-4 text-white/80 hover:text-white z-10 p-2"
        aria-label="Next image"
      >
        <ChevronRight size={36} />
      </button>
    </div>
  );
}
