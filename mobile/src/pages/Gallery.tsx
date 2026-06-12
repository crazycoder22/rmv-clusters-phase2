import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
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

  const countLabel =
    `${filtered.length} ${filtered.length === 1 ? "PHOTO" : "PHOTOS"}` +
    (category === "all" ? "" : ` · ${(CATEGORY_LABELS[category] ?? category).toUpperCase()}`);

  return (
    <div
      className="one-surface flex flex-1 flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header className="flex flex-shrink-0 items-center gap-3.5 px-[18px] pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-3">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text)" }} />
        </Link>
        <h1 className="min-w-0 flex-1 text-[26px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Gallery</h1>
      </header>

      {/* Filter chips */}
      <div className="flex flex-shrink-0 gap-2.5 overflow-x-auto px-[18px] pb-3.5 pt-1.5 [&::-webkit-scrollbar]:hidden">
        {data.categories.map((c) => {
          const on = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-semibold"
              style={on
                ? { background: "var(--accent-strong)", color: "var(--on-accent)", border: "1px solid var(--accent-strong)" }
                : { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border-strong)" }}
            >
              {CATEGORY_LABELS[c] ?? c}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-5">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((img) => (
            <button
              key={img.id}
              onClick={() => setLightbox(img)}
              className="relative overflow-hidden rounded-[18px] active:opacity-90"
              style={{ border: "1px solid var(--border)", background: "var(--surface-2)", boxShadow: "var(--shadow)" }}
            >
              <img
                src={imgUrl(img.thumb)}
                alt={img.alt}
                className="block h-[188px] w-full object-cover"
                loading="lazy"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-7 text-left"
                style={{ background: "linear-gradient(to top, rgba(5,8,15,0.86), rgba(5,8,15,0.32) 60%, transparent)" }}
              >
                <span className="text-[14px] font-semibold text-[#f3f6fb]" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                  {img.caption}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="one-mono mt-[18px] text-center text-[10px]" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>
          {countLabel}
        </div>
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
            <Icon name="close" size={20} style={{ color: "#fff" }} />
          </button>
          <img
            src={imgUrl(lightbox.src)}
            alt={lightbox.alt}
            className="max-h-[80vh] max-w-full rounded-[14px] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="mt-3 text-center text-[14px] text-white">{lightbox.caption}</p>
        </div>
      )}
    </div>
  );
}
