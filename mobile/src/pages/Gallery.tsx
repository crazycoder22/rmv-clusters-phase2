import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import clsx from "clsx";
import galleryData from "../data/gallery.json";
import { API_BASE_URL } from "../config";

type GalleryImage = {
  id: string;
  src: string;
  thumb: string;
  alt: string;
  caption: string;
  category: string;
  featured: boolean;
};

type GalleryData = {
  images: GalleryImage[];
  categories: string[];
};

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  blocks: "Blocks",
  "common-areas": "Common Areas",
  "play-areas": "Play Areas",
  surroundings: "Surroundings",
};

function imgUrl(relative: string): string {
  if (relative.startsWith("http")) return relative;
  return `${API_BASE_URL}${relative}`;
}

export default function GalleryPage() {
  const data = galleryData as GalleryData;
  const [category, setCategory] = useState<string>("all");
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);

  const filtered = useMemo(() => {
    if (category === "all") return data.images;
    return data.images.filter((i) => i.category === category);
  }, [data.images, category]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Gallery</h1>
      </header>

      <div className="-mx-4 mb-3 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          {data.categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={clsx(
                "flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              )}
            >
              {CATEGORY_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pb-4">
        {filtered.map((img) => (
          <button
            key={img.id}
            onClick={() => setLightbox(img)}
            className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800 active:opacity-80"
          >
            <img
              src={imgUrl(img.thumb)}
              alt={img.alt}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
            <p className="px-2 py-1.5 text-left text-[11px] text-slate-400">
              {img.caption}
            </p>
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top,1rem))] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X size={20} />
          </button>
          <img
            src={imgUrl(lightbox.src)}
            alt={lightbox.alt}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="mt-3 text-center text-sm text-white">
            {lightbox.caption}
          </p>
        </div>
      )}
    </div>
  );
}
