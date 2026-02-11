"use client";

import { useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import galleryData from "@/data/gallery.json";
import type { GalleryImage } from "@/types";
import LightboxModal from "./LightboxModal";

export default function GalleryGrid() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered =
    activeCategory === "all"
      ? (galleryData.images as GalleryImage[])
      : (galleryData.images.filter(
          (img) => img.category === activeCategory
        ) as GalleryImage[]);

  return (
    <>
      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {galleryData.categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize",
              activeCategory === cat
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {cat === "common-areas" ? "Common Areas" : cat}
          </button>
        ))}
      </div>

      {/* Masonry grid using CSS columns */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {filtered.map((image, index) => (
          <button
            key={image.id}
            onClick={() => setLightboxIndex(index)}
            className="block w-full break-inside-avoid group cursor-pointer"
          >
            <div className="relative overflow-hidden rounded-xl">
              <Image
                src={image.thumb}
                alt={image.alt}
                width={800}
                height={600}
                className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="absolute bottom-3 left-3 text-white text-sm font-medium">
                  {image.caption}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <LightboxModal
          images={filtered}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
