"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Play, ChevronRight, ArrowLeft } from "lucide-react";
import { extractYouTubeId, getYouTubeThumbnail, getYouTubeEmbedUrl } from "@/lib/youtube";

type VideoCategory = "LEARNING" | "TURNING_POINT" | "EVENTS" | "ANNOUNCEMENTS";

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  category: VideoCategory;
  featured: boolean;
}

const GROUPS: { value: VideoCategory; label: string; description: string; color: string; bg: string }[] = [
  {
    value: "LEARNING",
    label: "MyGate Learning",
    description: "Tutorials and how-to guides for residents",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800",
  },
  {
    value: "TURNING_POINT",
    label: "Turning Point",
    description: "Our community podcast show episodes",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800",
  },
  {
    value: "EVENTS",
    label: "Events",
    description: "Recordings from community events",
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800",
  },
  {
    value: "ANNOUNCEMENTS",
    label: "Announcements",
    description: "Official society video announcements",
    color: "text-yellow-700 dark:text-yellow-300",
    bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800",
  },
];

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<VideoCategory | null>(null);
  const [selected, setSelected] = useState<Video | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/videos");
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  // Close modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const activeGroupMeta = GROUPS.find((g) => g.value === activeGroup);
  const filteredVideos = activeGroup ? videos.filter((v) => v.category === activeGroup) : [];
  const selectedVideoId = selected ? extractYouTubeId(selected.youtubeUrl) : null;

  // ── GROUP LANDING VIEW ────────────────────────────────────────────────────
  const GroupLanding = () => {
    const nonEmptyGroups = GROUPS.filter((g) => videos.some((v) => v.category === g.value));

    if (loading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-2xl h-44" />
          ))}
        </div>
      );
    }

    if (nonEmptyGroups.length === 0) {
      return (
        <div className="text-center py-20">
          <p className="text-gray-400 dark:text-gray-500 text-lg">No videos added yet.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {nonEmptyGroups.map((group) => {
          const groupVideos = videos.filter((v) => v.category === group.value);
          // up to 4 preview thumbnails
          const previews = groupVideos.slice(0, 4);

          return (
            <button
              key={group.value}
              onClick={() => setActiveGroup(group.value)}
              className={`text-left rounded-2xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${group.bg}`}
            >
              {/* Thumbnail grid preview */}
              <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden mb-3 aspect-video">
                {previews.map((v) => {
                  const vid = extractYouTubeId(v.youtubeUrl);
                  return (
                    <div key={v.id} className="relative bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      {vid ? (
                        <img
                          src={getYouTubeThumbnail(vid)}
                          alt={v.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full" />
                      )}
                    </div>
                  );
                })}
                {/* Fill empty slots if fewer than 4 */}
                {Array.from({ length: Math.max(0, 4 - previews.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-gray-100 dark:bg-gray-700/50" />
                ))}
              </div>

              {/* Group info */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className={`font-bold text-base leading-snug ${group.color}`}>{group.label}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{group.description}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  <span className={`text-sm font-semibold ${group.color}`}>{groupVideos.length}</span>
                  <ChevronRight size={16} className={group.color} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // ── GROUP VIDEO GRID VIEW ─────────────────────────────────────────────────
  const GroupVideos = () => {
    if (!activeGroupMeta) return null;

    return (
      <>
        {/* Back + header */}
        <button
          onClick={() => setActiveGroup(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-5"
        >
          <ArrowLeft size={16} />
          All Groups
        </button>

        <div className="flex items-baseline gap-3 mb-6">
          <h2 className={`text-2xl font-bold ${activeGroupMeta.color}`}>{activeGroupMeta.label}</h2>
          <span className="text-sm text-gray-400 dark:text-gray-500">{filteredVideos.length} video{filteredVideos.length !== 1 ? "s" : ""}</span>
        </div>

        {filteredVideos.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-center py-16">No videos in this group yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredVideos.map((v) => {
              const vidId = extractYouTubeId(v.youtubeUrl);
              return (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className="text-left group focus:outline-none"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2.5 shadow-sm group-hover:shadow-md transition-shadow">
                    {vidId ? (
                      <img
                        src={getYouTubeThumbnail(vidId)}
                        alt={v.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-700" />
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
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                    {v.title}
                  </p>
                  {v.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 mt-0.5">
                      {v.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Page header */}
      {!activeGroup && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary-800 dark:text-primary-300 mb-2">Video Library</h1>
          <p className="text-gray-500 dark:text-gray-400">Choose a group below to browse and watch videos</p>
        </div>
      )}

      {/* Content */}
      {activeGroup ? <GroupVideos /> : <GroupLanding />}

      {/* Video Modal */}
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
                <p className={`text-xs font-semibold mb-0.5 ${activeGroupMeta?.color ?? "text-gray-500"}`}>
                  {activeGroupMeta?.label}
                </p>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
                  {selected.title}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              >
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
