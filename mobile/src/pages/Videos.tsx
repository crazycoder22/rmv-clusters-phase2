import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Video as VideoIcon } from "lucide-react";
import { Browser } from "@capacitor/browser";
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

function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function thumbnail(video: Video): string | null {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  const id = youtubeId(video.youtubeUrl);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

export default function VideosPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Videos</h1>
      </header>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : playlists.length === 0 ? (
        <div className="py-16 text-center">
          <VideoIcon size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No videos yet.</p>
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {playlists.map((p) => (
            <section key={p.id}>
              <div className="mb-2">
                <h2 className="text-sm font-semibold text-white">{p.title}</h2>
                {p.description && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {p.description}
                  </p>
                )}
              </div>
              {p.videos.length === 0 ? (
                <p className="rounded-xl border border-slate-700 bg-slate-800/40 py-6 text-center text-xs text-slate-500">
                  No videos in this playlist yet.
                </p>
              ) : (
                <div className="-mx-4 overflow-x-auto px-4">
                  <div className="flex gap-3 pb-2">
                    {p.videos.map((v) => {
                      const thumb = thumbnail(v);
                      return (
                        <button
                          key={v.id}
                          onClick={() => openVideo(v.youtubeUrl)}
                          className="flex w-56 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60 text-left active:bg-slate-800"
                        >
                          <div className="relative aspect-video w-full bg-slate-900">
                            {thumb && (
                              <img
                                src={thumb}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white">
                                <Play size={16} fill="currentColor" />
                              </div>
                            </div>
                            {v.featured && (
                              <span className="absolute left-1.5 top-1.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                Featured
                              </span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="line-clamp-2 text-xs font-medium text-slate-100">
                              {v.title}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
