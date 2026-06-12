import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Browser } from "@capacitor/browser";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";

type Video = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string | null;
  description: string | null;
  featured: boolean;
  order: number;
};

type Playlist = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  order: number;
  videos: Video[];
};

type FlatVideo = Video & { category: string; playlistTitle: string };

function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function thumbnail(video: Video): string | null {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  const id = youtubeId(video.youtubeUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

// OneRMV Videos.dc.html colours category pills; real categories are admin-defined
// so we cycle a fixed token palette by category index for a stable colour each.
const PALETTE: { color: string; soft: string }[] = [
  { color: "var(--accent)", soft: "var(--accent-soft)" },
  { color: "var(--info)", soft: "var(--info-soft)" },
  { color: "var(--success)", soft: "var(--success-soft)" },
  { color: "var(--warning)", soft: "var(--warning-soft)" },
  { color: "var(--danger)", soft: "var(--danger-soft)" },
];

// Striped placeholder for videos without a resolvable YouTube thumbnail.
const stripe =
  "repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 8px, var(--surface-3) 8px, var(--surface-3) 16px)";

export default function VideosPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/videos")
      .then((r) => (r.ok ? r.json() : { playlists: [] }))
      .then((data) => {
        if (!cancelled) setPlaylists(data.playlists ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openVideo = (url: string) => {
    Browser.open({ url }).catch(() => window.open(url, "_blank"));
  };

  // Flatten every playlist's videos, tagging each with its playlist category/title.
  const flat = useMemo<FlatVideo[]>(
    () =>
      playlists.flatMap((p) =>
        p.videos.map((v) => ({ ...v, category: p.category || p.title, playlistTitle: p.title }))
      ),
    [playlists]
  );

  // Distinct categories (in playlist order) → stable colour by index.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const v of flat) if (v.category && !seen.includes(v.category)) seen.push(v.category);
    return seen;
  }, [flat]);
  const catColor = (cat: string) => PALETTE[Math.max(0, categories.indexOf(cat)) % PALETTE.length];

  const featured = flat.find((v) => v.featured) ?? flat[0] ?? null;
  const listed = flat.filter(
    (v) => v.id !== featured?.id && (filter === "All" || v.category === filter)
  );

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 py-3">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>Videos</h1>
          <p className="mt-px text-[12px]" style={{ color: "var(--text-3)" }}>Step-by-step tutorials for residents</p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} /></div>
      ) : flat.length === 0 ? (
        <div className="py-16 text-center">
          <Icon name="smart_display" size={38} style={{ color: "var(--text-3)" }} />
          <p className="mt-2 text-[14px]" style={{ color: "var(--text-2)" }}>No videos yet.</p>
        </div>
      ) : (
        <>
          {/* Playlist meta */}
          <div className="one-mono mb-3 mt-1 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-3)" }}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="playlist_play" size={15} style={{ color: "var(--text-3)" }} />
              {flat.length} {flat.length === 1 ? "video" : "videos"}
            </span>
            <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--text-3)" }} />
            <span>{categories.length} {categories.length === 1 ? "category" : "categories"}</span>
          </div>

          {/* Featured hero */}
          {featured && (
            <button
              onClick={() => openVideo(featured.youtubeUrl)}
              className="relative block h-[178px] w-full overflow-hidden rounded-[20px] text-left active:opacity-95"
              style={{ border: "1px solid var(--border)", background: thumbnail(featured) ? undefined : stripe }}
            >
              {thumbnail(featured) && (
                <img src={thumbnail(featured)!} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,8,15,0) 38%, rgba(5,8,15,0.82) 100%)" }} />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold" style={{ background: "var(--warning)", color: "#3a2a05" }}>
                <Icon name="star" size={14} fill style={{ color: "#3a2a05" }} /> Featured
              </span>
              <div className="absolute left-1/2 top-1/2 flex h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: "rgba(5,8,15,0.55)", border: "1.5px solid rgba(255,255,255,0.35)" }}>
                <Icon name="play_arrow" size={34} fill style={{ color: "#fff" }} />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="text-[17px] font-extrabold leading-snug text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.4)" }}>{featured.title}</div>
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: catColor(featured.category).soft, color: catColor(featured.category).color }}>
                  {featured.category}
                </div>
              </div>
            </button>
          )}

          {/* Filter chips */}
          {categories.length > 0 && (
            <div className="-mx-[18px] mb-1 mt-4 flex gap-2 overflow-x-auto px-[18px] pb-1 [&::-webkit-scrollbar]:hidden">
              {["All", ...categories].map((c) => {
                const active = filter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className="flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold"
                    style={active
                      ? { background: "var(--accent-strong)", color: "#fff", border: "1px solid transparent" }
                      : { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}

          {/* Section label */}
          <div className="mx-0.5 mb-3 mt-3.5 flex items-baseline justify-between">
            <span className="one-mono text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>
              {filter === "All" ? "ALL TUTORIALS" : filter.toUpperCase()}
            </span>
            <span className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>
              {listed.length} {listed.length === 1 ? "video" : "videos"}
            </span>
          </div>

          {/* Video list */}
          {listed.length === 0 ? (
            <p className="rounded-[16px] px-4 py-9 text-center text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>
              No videos in this category.
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {listed.map((v) => {
                const thumb = thumbnail(v);
                const tone = catColor(v.category);
                return (
                  <button key={v.id} onClick={() => openVideo(v.youtubeUrl)} className="flex items-start gap-3 text-left active:opacity-80">
                    <div className="relative h-[72px] w-[124px] flex-shrink-0 overflow-hidden rounded-[13px]" style={{ border: "1px solid var(--border)", background: thumb ? undefined : stripe }}>
                      {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,8,15,0) 45%, rgba(5,8,15,0.55) 100%)" }} />
                      <div className="absolute left-1/2 top-1/2 flex h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: "rgba(5,8,15,0.5)", border: "1px solid rgba(255,255,255,0.3)" }}>
                        <Icon name="play_arrow" size={20} fill style={{ color: "#fff" }} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pt-px">
                      <div className="text-[14px] font-bold leading-snug" style={{ color: "var(--text)" }}>{v.title}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-[7px] px-2 py-0.5 text-[10.5px] font-bold" style={{ background: tone.soft, color: tone.color }}>{v.category}</span>
                        {v.playlistTitle && v.playlistTitle !== v.category && (
                          <span className="truncate text-[11.5px]" style={{ color: "var(--text-3)" }}>{v.playlistTitle}</span>
                        )}
                      </div>
                    </div>
                    <Icon name="open_in_new" size={18} style={{ color: "var(--text-3)" }} className="mt-0.5 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
