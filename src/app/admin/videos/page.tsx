"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/hooks/useRole";
import Link from "next/link";
import { Star, Pencil, Trash2, X, Plus } from "lucide-react";
import { extractYouTubeId, getYouTubeThumbnail } from "@/lib/youtube";

type VideoCategory = "LEARNING" | "TURNING_POINT" | "EVENTS" | "ANNOUNCEMENTS";

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  category: VideoCategory;
  featured: boolean;
  order: number;
  createdAt: string;
}

const CATEGORIES: { value: VideoCategory; label: string; color: string }[] = [
  { value: "LEARNING", label: "Learning", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  { value: "TURNING_POINT", label: "Turning Point", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" },
  { value: "EVENTS", label: "Events", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" },
  { value: "ANNOUNCEMENTS", label: "Announcements", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" },
];

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";

const emptyForm = {
  title: "",
  youtubeUrl: "",
  category: "LEARNING" as VideoCategory,
  description: "",
  featured: false,
  order: 0,
};

export default function AdminVideosPage() {
  const { isAdmin, isSuperAdmin, canManageAnnouncements, isLoading: roleLoading } = useRole();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [urlError, setUrlError] = useState("");

  const previewId = extractYouTubeId(form.youtubeUrl);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/videos");
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManageAnnouncements()) load();
  }, [canManageAnnouncements]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setUrlError("");
    setShowForm(true);
  };

  const openEdit = (v: Video) => {
    setForm({
      title: v.title,
      youtubeUrl: v.youtubeUrl,
      category: v.category,
      description: v.description || "",
      featured: v.featured,
      order: v.order,
    });
    setEditingId(v.id);
    setUrlError("");
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setUrlError("");
  };

  const handleUrlChange = (url: string) => {
    setForm((f) => ({ ...f, youtubeUrl: url }));
    if (url && !extractYouTubeId(url)) {
      setUrlError("Please enter a valid YouTube URL");
    } else {
      setUrlError("");
    }
  };

  const save = async () => {
    if (!form.title.trim()) return;
    if (!form.youtubeUrl.trim() || !extractYouTubeId(form.youtubeUrl)) {
      setUrlError("Please enter a valid YouTube URL");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/admin/videos/${editingId}` : "/api/admin/videos";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await load();
        cancelForm();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteVideo = async (v: Video) => {
    if (!confirm(`Delete "${v.title}"? This cannot be undone.`)) return;
    setDeletingId(v.id);
    try {
      await fetch(`/api/admin/videos/${v.id}`, { method: "DELETE" });
      setVideos((prev) => prev.filter((x) => x.id !== v.id));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleFeatured = async (v: Video) => {
    const res = await fetch(`/api/admin/videos/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !v.featured }),
    });
    if (res.ok) {
      setVideos((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, featured: !v.featured } : x))
      );
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!isAdmin() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-500 dark:text-gray-400">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Group videos by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    videos: videos.filter((v) => v.category === cat.value),
  })).filter((g) => g.videos.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link
        href="/admin"
        className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium mb-6 inline-block"
      >
        &larr; Back to Admin Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-300">Video Library</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{videos.length} video{videos.length !== 1 ? "s" : ""} total</p>
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            Add Video
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {editingId ? "Edit Video" : "Add New Video"}
            </h2>
            <button onClick={cancelForm} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. How to use MyGate for visitors"
                className={inputClass}
              />
            </div>

            {/* YouTube URL */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                YouTube URL <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="url"
                    value={form.youtubeUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className={inputClass}
                  />
                  {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
                </div>
                {previewId && (
                  <img
                    src={getYouTubeThumbnail(previewId)}
                    alt="Thumbnail preview"
                    className="w-24 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-600 flex-shrink-0"
                  />
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VideoCategory }))}
                className={inputClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Order <span className="text-xs text-gray-400">(lower = first)</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the video..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Featured toggle */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="featured"
                checked={form.featured}
                onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                className="w-4 h-4 accent-primary-600"
              />
              <label htmlFor="featured" className="text-sm text-gray-700 dark:text-gray-300">
                Feature this video <span className="text-xs text-gray-400">(shows at top of library)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={cancelForm}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Video"}
            </button>
          </div>
        </div>
      )}

      {/* Video list */}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</p>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-gray-400 dark:text-gray-500 mb-3">No videos yet</p>
          <button
            onClick={openAdd}
            className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline"
          >
            Add your first video
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.value}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${group.color}`}>
                  {group.label}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{group.videos.length} video{group.videos.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {group.videos.map((v) => {
                  const vidId = extractYouTubeId(v.youtubeUrl);
                  return (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3"
                    >
                      {/* Thumbnail */}
                      {vidId ? (
                        <img
                          src={getYouTubeThumbnail(vidId)}
                          alt={v.title}
                          className="w-16 h-11 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-11 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0" />
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.title}</p>
                          {v.featured && (
                            <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                          )}
                        </div>
                        {v.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{v.description}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleFeatured(v)}
                          title={v.featured ? "Unfeature" : "Feature"}
                          className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${v.featured ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
                        >
                          <Star size={15} className={v.featured ? "fill-yellow-400" : ""} />
                        </button>
                        <button
                          onClick={() => openEdit(v)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 dark:text-gray-500"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteVideo(v)}
                          disabled={deletingId === v.id}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-400 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
