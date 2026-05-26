import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Loader2,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
  Video as VideoIcon,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

type Category = "LEARNING" | "TURNING_POINT" | "EVENTS" | "ANNOUNCEMENTS";

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
  category: Category;
  order: number;
  videos: Video[];
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "LEARNING", label: "Learning" },
  { value: "TURNING_POINT", label: "Turning Point" },
  { value: "EVENTS", label: "Events" },
  { value: "ANNOUNCEMENTS", label: "Announcements" },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminVideos() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/video-playlists", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      setPlaylists(data.playlists ?? []);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = useMemo(
    () => ({
      playlists: playlists.length,
      videos: playlists.reduce((sum, p) => sum + p.videos.length, 0),
    }),
    [playlists]
  );

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">Video library</h1>
          <p className="truncate text-[11px] text-slate-500">
            {totals.playlists} playlist{totals.playlists !== 1 ? "s" : ""} ·{" "}
            {totals.videos} video{totals.videos !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewPlaylist((v) => !v)}
          className={clsx(
            "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium",
            showNewPlaylist
              ? "bg-slate-800 text-slate-300"
              : "bg-indigo-500 text-white active:bg-indigo-600"
          )}
        >
          {showNewPlaylist ? <X size={14} /> : <FolderPlus size={14} />}
          {showNewPlaylist ? "Close" : "Playlist"}
        </button>
      </header>

      {showNewPlaylist && (
        <PlaylistForm
          token={token}
          onCreated={(p) => {
            setPlaylists((prev) => [...prev, p]);
            setShowNewPlaylist(false);
            setExpandedId(p.id);
          }}
        />
      )}

      {error && (
        <p className="mb-3 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-2.5 text-xs text-red-200">
          {error}
        </p>
      )}

      <section className="flex-1 pb-4">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : playlists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            <VideoIcon size={28} className="mx-auto mb-2 text-slate-600" />
            No playlists yet.
          </div>
        ) : (
          <div className="space-y-2">
            {playlists.map((p) => (
              <PlaylistCard
                key={p.id}
                playlist={p}
                expanded={expandedId === p.id}
                onToggle={() =>
                  setExpandedId((cur) => (cur === p.id ? null : p.id))
                }
                onChanged={refresh}
                token={token}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Playlist card ──────────────────────────────────────────────────────────

function PlaylistCard({
  playlist,
  expanded,
  onToggle,
  onChanged,
  token,
}: {
  playlist: Playlist;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void | Promise<void>;
  token: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [addingVideo, setAddingVideo] = useState(false);
  const [busy, setBusy] = useState(false);

  async function deletePlaylist() {
    if (
      !confirm(
        `Delete "${playlist.name}" and all ${playlist.videos.length} video(s) in it?`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/video-playlists/${playlist.id}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-800/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
          <VideoIcon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {playlist.name}
            </p>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">
              {labelFor(playlist.category)}
            </span>
          </div>
          {playlist.description && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
              {playlist.description}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-slate-500">
            {playlist.videos.length} video
            {playlist.videos.length !== 1 ? "s" : ""}
            {playlist.videos.some((v) => v.featured) && " · ★ featured"}
          </p>
        </div>
        {expanded ? (
          <ChevronDown size={16} className="mt-1 flex-shrink-0 text-slate-500" />
        ) : (
          <ChevronRight size={16} className="mt-1 flex-shrink-0 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-slate-700 px-3 py-3">
          {/* Edit / delete buttons row */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-300 active:bg-slate-800"
            >
              <Pencil size={11} />
              {editing ? "Cancel edit" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => setAddingVideo((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-medium text-white active:bg-indigo-600"
            >
              {addingVideo ? <X size={11} /> : <Plus size={11} />}
              {addingVideo ? "Cancel video" : "Add video"}
            </button>
            <button
              type="button"
              onClick={deletePlaylist}
              disabled={busy}
              className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 active:bg-slate-800 active:text-red-300"
              aria-label="Delete playlist"
            >
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
            </button>
          </div>

          {editing && (
            <PlaylistEdit
              playlist={playlist}
              token={token}
              onSaved={() => {
                setEditing(false);
                void onChanged();
              }}
            />
          )}

          {addingVideo && (
            <VideoForm
              playlistId={playlist.id}
              token={token}
              onSaved={() => {
                setAddingVideo(false);
                void onChanged();
              }}
            />
          )}

          {/* Videos in this playlist */}
          {playlist.videos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-[11px] text-slate-500">
              No videos yet. Tap “Add video”.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {playlist.videos.map((v) => (
                <VideoRow
                  key={v.id}
                  video={v}
                  playlists={[playlist]}
                  token={token}
                  onChanged={onChanged}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

// ── Playlist forms ─────────────────────────────────────────────────────────

function PlaylistForm({
  token,
  onCreated,
}: {
  token: string | null;
  onCreated: (p: Playlist) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("LEARNING");
  const [order, setOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!name.trim()) {
      setErr("Name required");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/admin/video-playlists", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category,
          order,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Could not create");
        return;
      }
      const data = await res.json();
      onCreated(data.playlist);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-3 space-y-2.5 rounded-2xl border border-indigo-700/50 bg-slate-800/80 p-3">
      <Input
        label="Name"
        value={name}
        onChange={setName}
        placeholder='e.g. "Diwali Celebrations 2025"'
      />
      <div>
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-medium",
                category === c.value
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-900 text-slate-300 active:bg-slate-800"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <Input
        label="Description"
        value={description}
        onChange={setDescription}
        placeholder="Optional"
      />
      <div className="grid grid-cols-[1fr,80px] gap-2">
        <div />
        <Input
          label="Order"
          type="number"
          value={String(order)}
          onChange={(v) => setOrder(parseInt(v, 10) || 0)}
        />
      </div>
      {err && <ErrorPill>{err}</ErrorPill>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Create playlist
      </button>
    </section>
  );
}

function PlaylistEdit({
  playlist,
  token,
  onSaved,
}: {
  playlist: Playlist;
  token: string | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [category, setCategory] = useState<Category>(playlist.category);
  const [order, setOrder] = useState(playlist.order);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const res = await apiFetch(
        `/api/admin/video-playlists/${playlist.id}`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            category,
            order,
          }),
        }
      );
      if (!res.ok) {
        setErr("Could not save");
        return;
      }
      onSaved();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2.5 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
      <Input label="Name" value={name} onChange={setName} />
      <div>
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-medium",
                category === c.value
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-900 text-slate-300 active:bg-slate-800"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <Input
        label="Description"
        value={description}
        onChange={setDescription}
      />
      <Input
        label="Order"
        type="number"
        value={String(order)}
        onChange={(v) => setOrder(parseInt(v, 10) || 0)}
      />
      {err && <ErrorPill>{err}</ErrorPill>}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 py-2 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Save changes
      </button>
    </section>
  );
}

// ── Video form (create or edit) ─────────────────────────────────────────────

function VideoForm({
  playlistId,
  token,
  existing,
  playlists,
  onSaved,
}: {
  playlistId: string;
  token: string | null;
  existing?: Video;
  playlists?: Playlist[];
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(existing?.youtubeUrl ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [featured, setFeatured] = useState(existing?.featured ?? false);
  const [order, setOrder] = useState(existing?.order ?? 0);
  const [targetPlaylist, setTargetPlaylist] = useState(
    existing?.playlistId ?? playlistId
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const thumbId = extractYouTubeId(youtubeUrl);

  async function submit() {
    setErr(null);
    if (!title.trim()) {
      setErr("Title required");
      return;
    }
    if (!thumbId) {
      setErr("Paste a valid YouTube URL");
      return;
    }
    setBusy(true);
    try {
      const url = isEdit
        ? `/api/admin/videos/${existing!.id}`
        : "/api/admin/videos";
      const method = isEdit ? "PATCH" : "POST";
      const res = await apiFetch(url, {
        method,
        token,
        body: JSON.stringify({
          title: title.trim(),
          youtubeUrl: youtubeUrl.trim(),
          playlistId: targetPlaylist,
          description: description.trim() || null,
          featured,
          order,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Could not save");
        return;
      }
      onSaved();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2.5 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
      <Input label="Title" value={title} onChange={setTitle} />
      <Input
        label="YouTube URL"
        value={youtubeUrl}
        onChange={setYoutubeUrl}
        placeholder="https://youtube.com/watch?v=…"
      />
      {thumbId && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${thumbId}/hqdefault.jpg`}
            alt="Thumbnail"
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
            <Play size={28} className="text-white" />
          </div>
        </div>
      )}
      <Input label="Description" value={description} onChange={setDescription} />
      {playlists && playlists.length > 1 && (
        <div>
          <Label>Move to playlist</Label>
          <select
            value={targetPlaylist}
            onChange={(e) => setTargetPlaylist(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
          >
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Order"
          type="number"
          value={String(order)}
          onChange={(v) => setOrder(parseInt(v, 10) || 0)}
        />
        <div>
          <Label>Featured</Label>
          <button
            type="button"
            onClick={() => setFeatured((v) => !v)}
            className={clsx(
              "flex w-full items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-medium",
              featured
                ? "bg-amber-500 text-white"
                : "bg-slate-900 text-slate-300 active:bg-slate-800"
            )}
          >
            <Star size={12} className={featured ? "fill-current" : ""} />
            {featured ? "Featured" : "Off"}
          </button>
        </div>
      </div>
      {err && <ErrorPill>{err}</ErrorPill>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 py-2 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        {isEdit ? "Save video" : "Add video"}
      </button>
    </section>
  );
}

// ── Video row ──────────────────────────────────────────────────────────────

function VideoRow({
  video,
  playlists,
  token,
  onChanged,
}: {
  video: Video;
  playlists: Playlist[];
  token: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const thumbId = extractYouTubeId(video.youtubeUrl);

  async function toggleFeatured() {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/videos/${video.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ featured: !video.featured }),
      });
      if (res.ok) await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function deleteVideo() {
    if (!confirm(`Delete "${video.title}"?`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/videos/${video.id}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/40">
      <div className="flex items-start gap-2 p-2">
        {thumbId && (
          <div className="relative aspect-video w-20 flex-shrink-0 overflow-hidden rounded-md bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${thumbId}/default.jpg`}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[12px] font-semibold text-white">
              {video.title}
            </p>
            {video.featured && (
              <Star size={11} className="flex-shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>
          {video.description && (
            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
              {video.description}
            </p>
          )}
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              disabled={busy}
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-medium text-slate-300 active:bg-slate-700"
            >
              <Pencil size={9} /> Edit
            </button>
            <button
              type="button"
              onClick={toggleFeatured}
              disabled={busy}
              className={clsx(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-medium",
                video.featured
                  ? "bg-amber-500/30 text-amber-200 active:bg-amber-500/40"
                  : "bg-slate-800 text-slate-300 active:bg-slate-700"
              )}
            >
              <Star size={9} className={video.featured ? "fill-current" : ""} />
              {video.featured ? "Featured" : "Feature"}
            </button>
            <button
              type="button"
              onClick={deleteVideo}
              disabled={busy}
              className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 active:bg-slate-800 active:text-red-300"
              aria-label="Delete video"
            >
              {busy ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Trash2 size={10} />
              )}
            </button>
          </div>
        </div>
      </div>
      {editing && (
        <div className="border-t border-slate-700 p-2">
          <VideoForm
            playlistId={video.playlistId}
            playlists={playlists}
            existing={video}
            token={token}
            onSaved={() => {
              setEditing(false);
              void onChanged();
            }}
          />
        </div>
      )}
    </li>
  );
}

// ── Reusable form bits ─────────────────────────────────────────────────────

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
      />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

function ErrorPill({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-1.5 text-[11px] text-red-200">
      {children}
    </p>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function labelFor(cat: Category): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

// Match the server-side `extractYouTubeId` semantics: accepts watch?v=,
// youtu.be/, embed/, and shorts/ formats. Returns null on miss.
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}
