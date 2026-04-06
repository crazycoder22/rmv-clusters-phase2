"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Play, ArrowLeft, Link as LinkIcon, Check } from "lucide-react";
import { extractYouTubeId, getYouTubeThumbnail, getYouTubeEmbedUrl } from "@/lib/youtube";

type VideoCategory = "LEARNING" | "TURNING_POINT" | "EVENTS" | "ANNOUNCEMENTS";

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  featured: boolean;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  category: VideoCategory;
  videos: Video[];
}

const CATEGORY_COLORS: Record<VideoCategory, string> = {
  LEARNING: "text-blue-600 dark:text-blue-400",
  TURNING_POINT: "text-purple-600 dark:text-purple-400",
  EVENTS: "text-green-600 dark:text-green-400",
  ANNOUNCEMENTS: "text-yellow-600 dark:text-yellow-400",
};

const CATEGORY_BADGE: Record<VideoCategory, string> = {
  LEARNING: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  TURNING_POINT: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  EVENTS: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  ANNOUNCEMENTS: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
};

const CATEGORY_LABELS: Record<VideoCategory, string> = {
  LEARNING: "Learning",
  TURNING_POINT: "Turning Point",
  EVENTS: "Events",
  ANNOUNCEMENTS: "Announcements",
};

const CATEGORY_BG: Record<VideoCategory, string> = {
  LEARNING: "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600",
  TURNING_POINT: "bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-600",
  EVENTS: "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800 hover:border-green-300 dark:hover:border-green-600",
  ANNOUNCEMENTS: "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-800 hover:border-yellow-300 dark:hover:border-yellow-600",
};

function VideosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [selected, setSelected] = useState<Video | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/videos");
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);

  // Sync URL param → activePlaylist once playlists are loaded
  useEffect(() => {
    if (playlists.length === 0) return;
    const pid = searchParams.get("p");
    if (pid) {
      const found = playlists.find((pl) => pl.id === pid);
      if (found) setActivePlaylist(found);
    } else {
      setActivePlaylist(null);
    }
  }, [playlists, searchParams]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openPlaylist = (playlist: Playlist) => {
    router.push(`/videos?p=${playlist.id}`);
  };

  const goBack = () => {
    router.push("/videos");
    setSelected(null);
  };

  const copyLink = async () => {
    if (!activePlaylist) return;
    const url = `${window.location.origin}/videos?p=${activePlaylist.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedVideoId = selected ? extractYouTubeId(selected.youtubeUrl) : null;
  const nonEmpty = playlists.filter((p) => p.videos.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">

      {/* ── PLAYLIST LANDING ─────────────────────────────────────────────── */}
      {!activePlaylist && (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary-800 dark:text-primary-300 mb-2">Video Library</h1>
            <p className="text-gray-500 dark:text-gray-400">Select a playlist to browse and watch videos</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-2xl h-48" />
              ))}
            </div>
          ) : nonEmpty.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 dark:text-gray-500 text-lg">No videos added yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {nonEmpty.map((playlist) => {
                const previews = playlist.videos.slice(0, 4);
                return (
                  <button
                    key={playlist.id}
                    onClick={() => openPlaylist(playlist)}
                    className={`text-left rounded-2xl border-2 p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${CATEGORY_BG[playlist.category]}`}
                  >
                    {/* 2×2 thumbnail grid */}
                    <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden mb-3" style={{ aspectRatio: "16/9" }}>
                      {previews.map((v) => {
                        const vid = extractYouTubeId(v.youtubeUrl);
                        return (
                          <div key={v.id} className="relative bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            {vid && <img src={getYouTubeThumbnail(vid)} alt={v.title} className="w-full h-full object-cover" />}
                          </div>
                        );
                      })}
                      {Array.from({ length: Math.max(0, 4 - previews.length) }).map((_, i) => (
                        <div key={`e-${i}`} className="bg-gray-100 dark:bg-gray-700/40" />
                      ))}
                    </div>

                    {/* Info row */}
                    <div className="flex items-start justify-between gap-2 mt-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${CATEGORY_BADGE[playlist.category]}`}>
                            {CATEGORY_LABELS[playlist.category]}
                          </span>
                        </div>
                        <h3 className={`font-bold text-base leading-snug ${CATEGORY_COLORS[playlist.category]}`}>
                          {playlist.name}
                        </h3>
                        {playlist.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{playlist.description}</p>
                        )}
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 mt-0.5 ${CATEGORY_COLORS[playlist.category]}`}>
                        {playlist.videos.length} video{playlist.videos.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── PLAYLIST VIDEO GRID ──────────────────────────────────────────── */}
      {activePlaylist && (
        <>
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Library
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <LinkIcon size={14} />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          <div className="flex items-baseline gap-3 mb-1">
            <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${CATEGORY_BADGE[activePlaylist.category]}`}>
              {CATEGORY_LABELS[activePlaylist.category]}
            </span>
          </div>
          <h2 className={`text-2xl font-bold mb-1 ${CATEGORY_COLORS[activePlaylist.category]}`}>{activePlaylist.name}</h2>
          {activePlaylist.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{activePlaylist.description}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
            {activePlaylist.videos.length} video{activePlaylist.videos.length !== 1 ? "s" : ""}
          </p>

          {activePlaylist.videos.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-center py-16">No videos in this playlist yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {activePlaylist.videos.map((v) => {
                const vidId = extractYouTubeId(v.youtubeUrl);
                return (
                  <button key={v.id} onClick={() => setSelected(v)} className="text-left group focus:outline-none">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2.5 shadow-sm group-hover:shadow-md transition-shadow">
                      {vidId && (
                        <img
                          src={getYouTubeThumbnail(vidId)}
                          alt={v.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-200">
                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg">
                          <Play size={18} className="text-gray-900 ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                      {v.featured && (
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-400 text-yellow-900">
                          ★ Featured
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">{v.title}</p>
                    {v.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 mt-0.5">{v.description}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── VIDEO MODAL ──────────────────────────────────────────────────── */}
      {selected && selectedVideoId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-4 pb-0">
              <div className="flex-1 pr-4">
                {activePlaylist && (
                  <p className={`text-xs font-semibold mb-0.5 ${CATEGORY_COLORS[activePlaylist.category]}`}>
                    {activePlaylist.name}
                  </p>
                )}
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0">
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="relative aspect-video mt-3">
              <iframe
                src={getYouTubeEmbedUrl(selectedVideoId, true)}
                title={selected.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>

            {selected.description && (
              <div className="px-4 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">{selected.description}</p>
              </div>
            )}
            {!selected.description && <div className="pb-1" />}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VideosPage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    }>
      <VideosContent />
    </Suspense>
  );
}
