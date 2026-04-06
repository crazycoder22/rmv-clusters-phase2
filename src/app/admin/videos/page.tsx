"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/hooks/useRole";
import Link from "next/link";
import { Star, Pencil, Trash2, X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { extractYouTubeId, getYouTubeThumbnail } from "@/lib/youtube";

type VideoCategory = "LEARNING" | "TURNING_POINT" | "EVENTS" | "ANNOUNCEMENTS";

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  playlistId: string;
  featured: boolean;
  order: number;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  category: VideoCategory;
  order: number;
  videos: Video[];
}

const CATEGORIES: { value: VideoCategory; label: string; color: string }[] = [
  { value: "LEARNING", label: "Learning", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  { value: "TURNING_POINT", label: "Turning Point", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" },
  { value: "EVENTS", label: "Events", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" },
  { value: "ANNOUNCEMENTS", label: "Announcements", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" },
];

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";

const emptyPlaylistForm = { name: "", description: "", category: "LEARNING" as VideoCategory, order: 0 };
const emptyVideoForm = { title: "", youtubeUrl: "", playlistId: "", description: "", featured: false, order: 0 };

export default function AdminVideosPage() {
  const { isAdmin, isSuperAdmin, canManageAnnouncements, isLoading: roleLoading } = useRole();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"playlists" | "videos">("playlists");

  // Playlist form state
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [playlistForm, setPlaylistForm] = useState(emptyPlaylistForm);
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);

  // Video form state
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoForm, setVideoForm] = useState(emptyVideoForm);
  const [savingVideo, setSavingVideo] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [videoUrlError, setVideoUrlError] = useState("");

  const previewId = extractYouTubeId(videoForm.youtubeUrl);
  const allVideos = playlists.flatMap((p) => p.videos.map((v) => ({ ...v, playlist: p })));

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/video-playlists");
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManageAnnouncements()) load();
  }, [canManageAnnouncements]);

  // ── Playlist CRUD ─────────────────────────────────────────────────────────
  const openAddPlaylist = () => {
    setPlaylistForm(emptyPlaylistForm);
    setEditingPlaylistId(null);
    setShowPlaylistForm(true);
  };

  const openEditPlaylist = (p: Playlist) => {
    setPlaylistForm({ name: p.name, description: p.description || "", category: p.category, order: p.order });
    setEditingPlaylistId(p.id);
    setShowPlaylistForm(true);
  };

  const savePlaylist = async () => {
    if (!playlistForm.name.trim()) return;
    setSavingPlaylist(true);
    try {
      const url = editingPlaylistId ? `/api/admin/video-playlists/${editingPlaylistId}` : "/api/admin/video-playlists";
      const method = editingPlaylistId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playlistForm),
      });
      if (res.ok) {
        await load();
        setShowPlaylistForm(false);
        setEditingPlaylistId(null);
      }
    } finally {
      setSavingPlaylist(false);
    }
  };

  const deletePlaylist = async (p: Playlist) => {
    if (!confirm(`Delete "${p.name}" and all ${p.videos.length} video(s)? This cannot be undone.`)) return;
    setDeletingPlaylistId(p.id);
    try {
      await fetch(`/api/admin/video-playlists/${p.id}`, { method: "DELETE" });
      setPlaylists((prev) => prev.filter((x) => x.id !== p.id));
    } finally {
      setDeletingPlaylistId(null);
    }
  };

  // ── Video CRUD ────────────────────────────────────────────────────────────
  const openAddVideo = (playlistId?: string) => {
    setVideoForm({ ...emptyVideoForm, playlistId: playlistId || (playlists[0]?.id ?? "") });
    setEditingVideoId(null);
    setVideoUrlError("");
    setShowVideoForm(true);
    setActiveTab("videos");
  };

  const openEditVideo = (v: Video) => {
    setVideoForm({
      title: v.title,
      youtubeUrl: v.youtubeUrl,
      playlistId: v.playlistId,
      description: v.description || "",
      featured: v.featured,
      order: v.order,
    });
    setEditingVideoId(v.id);
    setVideoUrlError("");
    setShowVideoForm(true);
    setActiveTab("videos");
  };

  const handleVideoUrlChange = (url: string) => {
    setVideoForm((f) => ({ ...f, youtubeUrl: url }));
    if (url && !extractYouTubeId(url)) setVideoUrlError("Please enter a valid YouTube URL");
    else setVideoUrlError("");
  };

  const saveVideo = async () => {
    if (!videoForm.title.trim()) return;
    if (!videoForm.youtubeUrl.trim() || !extractYouTubeId(videoForm.youtubeUrl)) {
      setVideoUrlError("Please enter a valid YouTube URL");
      return;
    }
    if (!videoForm.playlistId) return;

    setSavingVideo(true);
    try {
      const url = editingVideoId ? `/api/admin/videos/${editingVideoId}` : "/api/admin/videos";
      const method = editingVideoId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoForm),
      });
      if (res.ok) {
        await load();
        setShowVideoForm(false);
        setEditingVideoId(null);
      }
    } finally {
      setSavingVideo(false);
    }
  };

  const deleteVideo = async (v: Video) => {
    if (!confirm(`Delete "${v.title}"?`)) return;
    setDeletingVideoId(v.id);
    try {
      await fetch(`/api/admin/videos/${v.id}`, { method: "DELETE" });
      await load();
    } finally {
      setDeletingVideoId(null);
    }
  };

  const toggleFeatured = async (v: Video) => {
    await fetch(`/api/admin/videos/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !v.featured }),
    });
    await load();
  };

  if (roleLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500 dark:text-gray-400">Loading...</p></div>;
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

  const totalVideos = playlists.reduce((sum, p) => sum + p.videos.length, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/admin" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium mb-6 inline-block">
        &larr; Back to Admin Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-300">Video Library</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {playlists.length} playlist{playlists.length !== 1 ? "s" : ""} · {totalVideos} video{totalVideos !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "playlists" ? (
            <button onClick={openAddPlaylist} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              <Plus size={15} /> Add Playlist
            </button>
          ) : (
            <button onClick={() => openAddVideo()} disabled={playlists.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
              <Plus size={15} /> Add Video
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {(["playlists", "videos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors",
              activeTab === tab
                ? "border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</p>
      ) : (
        <>
          {/* ── PLAYLISTS TAB ── */}
          {activeTab === "playlists" && (
            <>
              {/* Add/Edit Playlist Form */}
              {showPlaylistForm && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {editingPlaylistId ? "Edit Playlist" : "New Playlist"}
                    </h2>
                    <button onClick={() => { setShowPlaylistForm(false); setEditingPlaylistId(null); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X size={18} className="text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={playlistForm.name}
                        onChange={(e) => setPlaylistForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder='e.g. "Turning Point", "MyGate Onboarding Guide"'
                        className={inputClass}
                        onKeyDown={(e) => e.key === "Enter" && savePlaylist()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                      <select value={playlistForm.category} onChange={(e) => setPlaylistForm((f) => ({ ...f, category: e.target.value as VideoCategory }))} className={inputClass}>
                        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order <span className="text-xs text-gray-400">(lower = first)</span></label>
                      <input type="number" min={0} value={playlistForm.order} onChange={(e) => setPlaylistForm((f) => ({ ...f, order: Number(e.target.value) }))} className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-xs text-gray-400">(optional)</span></label>
                      <textarea rows={2} value={playlistForm.description} onChange={(e) => setPlaylistForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description..." className={`${inputClass} resize-none`} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => { setShowPlaylistForm(false); setEditingPlaylistId(null); }} disabled={savingPlaylist} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                    <button onClick={savePlaylist} disabled={savingPlaylist || !playlistForm.name.trim()} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                      {savingPlaylist ? "Saving..." : editingPlaylistId ? "Save Changes" : "Create Playlist"}
                    </button>
                  </div>
                </div>
              )}

              {playlists.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <p className="text-gray-400 dark:text-gray-500 mb-3">No playlists yet</p>
                  <button onClick={openAddPlaylist} className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline">Create your first playlist</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {playlists.map((p) => {
                    const catMeta = CATEGORIES.find((c) => c.value === p.category);
                    const expanded = expandedPlaylistId === p.id;
                    return (
                      <div key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        {/* Playlist header row */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button onClick={() => setExpandedPlaylistId(expanded ? null : p.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{p.name}</span>
                                {catMeta && <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${catMeta.color}`}>{catMeta.label}</span>}
                                <span className="text-xs text-gray-400 dark:text-gray-500">{p.videos.length} video{p.videos.length !== 1 ? "s" : ""}</span>
                              </div>
                              {p.description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{p.description}</p>}
                            </div>
                            {expanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                          </button>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => openAddVideo(p.id)} title="Add video" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-primary-500 transition-colors">
                              <Plus size={15} />
                            </button>
                            <button onClick={() => openEditPlaylist(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deletePlaylist(p)} disabled={deletingPlaylistId === p.id} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 disabled:opacity-50 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded video list */}
                        {expanded && (
                          <div className="border-t border-gray-100 dark:border-gray-700">
                            {p.videos.length === 0 ? (
                              <div className="px-4 py-4 text-center">
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">No videos yet</p>
                                <button onClick={() => openAddVideo(p.id)} className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline">+ Add video</button>
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                {p.videos.map((v) => {
                                  const vid = extractYouTubeId(v.youtubeUrl);
                                  return (
                                    <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                                      {vid ? (
                                        <img src={getYouTubeThumbnail(vid)} alt={v.title} className="w-14 h-9 object-cover rounded flex-shrink-0" />
                                      ) : (
                                        <div className="w-14 h-9 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{v.title}</p>
                                          {v.featured && <Star size={11} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                                        </div>
                                        {v.description && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{v.description}</p>}
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={() => toggleFeatured(v)} className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${v.featured ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}>
                                          <Star size={13} className={v.featured ? "fill-yellow-400" : ""} />
                                        </button>
                                        <button onClick={() => openEditVideo(v)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                                          <Pencil size={12} />
                                        </button>
                                        <button onClick={() => deleteVideo(v)} disabled={deletingVideoId === v.id} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 disabled:opacity-50">
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── VIDEOS TAB ── */}
          {activeTab === "videos" && (
            <>
              {playlists.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-3 mb-5 text-sm text-yellow-700 dark:text-yellow-300">
                  Create a playlist first before adding videos.{" "}
                  <button onClick={() => setActiveTab("playlists")} className="underline font-medium">Go to Playlists</button>
                </div>
              )}

              {/* Add/Edit Video Form */}
              {showVideoForm && playlists.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{editingVideoId ? "Edit Video" : "Add Video"}</h2>
                    <button onClick={() => { setShowVideoForm(false); setEditingVideoId(null); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X size={18} className="text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title <span className="text-red-500">*</span></label>
                      <input type="text" value={videoForm.title} onChange={(e) => setVideoForm((f) => ({ ...f, title: e.target.value }))} placeholder="Video title" className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">YouTube URL <span className="text-red-500">*</span></label>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <input type="url" value={videoForm.youtubeUrl} onChange={(e) => handleVideoUrlChange(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className={inputClass} />
                          {videoUrlError && <p className="text-xs text-red-500 mt-1">{videoUrlError}</p>}
                        </div>
                        {previewId && (
                          <img src={getYouTubeThumbnail(previewId)} alt="preview" className="w-24 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Playlist <span className="text-red-500">*</span></label>
                      <select value={videoForm.playlistId} onChange={(e) => setVideoForm((f) => ({ ...f, playlistId: e.target.value }))} className={inputClass}>
                        <option value="">Select playlist...</option>
                        {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order <span className="text-xs text-gray-400">(lower = first)</span></label>
                      <input type="number" min={0} value={videoForm.order} onChange={(e) => setVideoForm((f) => ({ ...f, order: Number(e.target.value) }))} className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-xs text-gray-400">(optional)</span></label>
                      <textarea rows={2} value={videoForm.description} onChange={(e) => setVideoForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description..." className={`${inputClass} resize-none`} />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input type="checkbox" id="vfeatured" checked={videoForm.featured} onChange={(e) => setVideoForm((f) => ({ ...f, featured: e.target.checked }))} className="w-4 h-4 accent-primary-600" />
                      <label htmlFor="vfeatured" className="text-sm text-gray-700 dark:text-gray-300">Feature this video <span className="text-xs text-gray-400">(shows at top of playlist)</span></label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => { setShowVideoForm(false); setEditingVideoId(null); }} disabled={savingVideo} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                    <button onClick={saveVideo} disabled={savingVideo} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                      {savingVideo ? "Saving..." : editingVideoId ? "Save Changes" : "Add Video"}
                    </button>
                  </div>
                </div>
              )}

              {allVideos.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <p className="text-gray-400 dark:text-gray-500 mb-1">No videos yet</p>
                  {playlists.length > 0 && <button onClick={() => openAddVideo()} className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline">Add your first video</button>}
                </div>
              ) : (
                <div className="space-y-2">
                  {allVideos.map(({ playlist: pl, ...v }) => {
                    const vid = extractYouTubeId(v.youtubeUrl);
                    const catMeta = CATEGORIES.find((c) => c.value === pl.category);
                    return (
                      <div key={v.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                        {vid ? <img src={getYouTubeThumbnail(vid)} alt={v.title} className="w-16 h-11 object-cover rounded flex-shrink-0" /> : <div className="w-16 h-11 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.title}</p>
                            {v.featured && <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-400 dark:text-gray-500">{pl.name}</span>
                            {catMeta && <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${catMeta.color}`}>{catMeta.label}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => toggleFeatured(v)} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${v.featured ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}>
                            <Star size={14} className={v.featured ? "fill-yellow-400" : ""} />
                          </button>
                          <button onClick={() => openEditVideo(v)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteVideo(v)} disabled={deletingVideoId === v.id} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 disabled:opacity-50">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
