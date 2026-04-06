"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Play } from "lucide-react";
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

const TABS: { value: "ALL" | VideoCategory; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "LEARNING", label: "Learning" },
  { value: "TURNING_POINT", label: "Turning Point" },
  { value: "EVENTS", label: "Events" },
  { value: "ANNOUNCEMENTS", label: "Announcements" },
];

const CATEGORY_COLORS: Record<VideoCategory, string> = {
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

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | VideoCategory>("ALL");
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

  // Close modal on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = activeTab === "ALL"
    ? videos
    : videos.filter((v) => v.category === activeTab);

  const counts: Record<string, number> = { ALL: videos.length };
  for (const tab of TABS.slice(1)) {
    counts[tab.value] = videos.filter((v) => v.category === tab.value).length;
  }

  const selectedVideoId = selected ? extractYouTubeId(selected.youtubeUrl) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary-800 dark:text-primary-300 mb-2">Video Library</h1>
        <p className="text-gray-500 dark:text-gray-400">Watch tutorials, community shows and event recordings</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto mb-8 border-b border-gray-200 dark:border-gray-700 pb-0">
        {TABS.map((tab) => {
          const count = counts[tab.value] ?? 0;
          if (tab.value !== "ALL" && count === 0) return null;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={[
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                activeTab === tab.value
                  ? "border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
              ].join(" ")}
            >
              {tab.label}
              {count > 0 && (
                <span className={[
                  "ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-medium",
                  activeTab === tab.value
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                ].join(" ")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-xl aspect-video mb-2" />
              <div className="bg-gray-200 dark:bg-gray-700 h-4 rounded w-3/4 mb-1" />
              <div className="bg-gray-200 dark:bg-gray-700 h-3 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 dark:text-gray-500 text-lg">No videos in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((v) => {
            const vidId = extractYouTubeId(v.youtubeUrl);
            return (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className="text-left group focus:outline-none"
              >
                {/* Thumbnail */}
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
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-200">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg">
                      <Play size={18} className="text-gray-900 ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                  {/* Featured badge */}
                  {v.featured && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-400 text-yellow-900">
                      ★ Featured
                    </div>
                  )}
                </div>

                {/* Meta */}
                <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full mb-1 ${CATEGORY_COLORS[v.category]}`}>
                  {CATEGORY_LABELS[v.category]}
                </span>
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
            {/* Modal header */}
            <div className="flex items-start justify-between p-4 pb-0">
              <div className="flex-1 pr-4">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full mb-1 ${CATEGORY_COLORS[selected.category]}`}>
                  {CATEGORY_LABELS[selected.category]}
                </span>
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

            {/* iframe */}
            <div className="relative aspect-video mt-3">
              <iframe
                src={getYouTubeEmbedUrl(selectedVideoId, true)}
                title={selected.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>

            {/* Description */}
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
