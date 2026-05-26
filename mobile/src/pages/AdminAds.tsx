import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CircleDot,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";
import { isAdmin } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

type Placement = "top" | "bottom";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string;
  placement: Placement;
  pages: string[];
  startDate: string;
  endDate: string;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

const PAGE_OPTIONS = [
  "news",
  "marketplace",
  "wordle",
  "sudoku",
  "crossword",
  "memory",
  "2048",
  "quiz",
  "community",
  "events",
  "newsletters",
];

const PLACEMENT_OPTIONS: { value: Placement; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminAds() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isAdmin(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/ads", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      setAds(data.ads ?? []);
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

  const stats = useMemo(() => {
    const today = isoToday();
    let active = 0;
    let scheduled = 0;
    let expired = 0;
    let impressions = 0;
    let clicks = 0;
    for (const a of ads) {
      impressions += a.impressions;
      clicks += a.clicks;
      if (!a.active) continue;
      if (a.startDate > today) scheduled++;
      else if (a.endDate < today) expired++;
      else active++;
    }
    return { active, scheduled, expired, impressions, clicks };
  }, [ads]);

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
          <h1 className="text-lg font-semibold text-white">Banner ads</h1>
          <p className="truncate text-[11px] text-slate-500">
            {stats.active} live · {stats.scheduled} scheduled ·{" "}
            {stats.expired} expired
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditingId((cur) => (cur === "new" ? null : "new"))
          }
          className={clsx(
            "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium",
            editingId === "new"
              ? "bg-slate-800 text-slate-300"
              : "bg-indigo-500 text-white active:bg-indigo-600"
          )}
        >
          {editingId === "new" ? <X size={14} /> : <Plus size={14} />}
          {editingId === "new" ? "Close" : "New"}
        </button>
      </header>

      {/* Summary cards */}
      <section className="mb-3 grid grid-cols-2 gap-2">
        <Stat
          value={stats.impressions}
          label="impressions"
          icon={Eye}
          tint="bg-indigo-500/15 text-indigo-200"
        />
        <Stat
          value={stats.clicks}
          label="clicks"
          icon={MousePointerClick}
          tint="bg-emerald-500/15 text-emerald-200"
        />
      </section>

      {editingId === "new" && (
        <AdForm
          token={token}
          onSaved={async () => {
            setEditingId(null);
            await refresh();
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
        ) : ads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No ads yet. Tap{" "}
            <span className="text-indigo-300">New</span> to add the first one.
          </div>
        ) : (
          <div className="space-y-2">
            {ads.map((a) => (
              <AdCard
                key={a.id}
                ad={a}
                editing={editingId === a.id}
                onToggleEdit={() =>
                  setEditingId((cur) => (cur === a.id ? null : a.id))
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

// ── Sub-components ─────────────────────────────────────────────────────────

function AdCard({
  ad,
  editing,
  onToggleEdit,
  onChanged,
  token,
}: {
  ad: Ad;
  editing: boolean;
  onToggleEdit: () => void;
  onChanged: () => void | Promise<void>;
  token: string | null;
}) {
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/ads/${ad.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: !ad.active }),
      });
      if (res.ok) await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${ad.title}"? Stats are lost too.`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/ads/${ad.id}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const status = statusOf(ad);
  const ctr =
    ad.impressions > 0
      ? Math.round((ad.clicks / ad.impressions) * 100 * 10) / 10
      : 0;

  return (
    <article
      className={clsx(
        "overflow-hidden rounded-2xl border",
        status === "live"
          ? "border-emerald-700/40 bg-slate-800/60"
          : "border-slate-700 bg-slate-800/40"
      )}
    >
      <button
        type="button"
        onClick={onToggleEdit}
        className="block w-full text-left"
      >
        <div className="relative h-20 w-full overflow-hidden bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute right-2 top-2 flex gap-1">
            <StatusBadge status={status} />
            {!ad.active && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                <EyeOff size={9} /> OFF
              </span>
            )}
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-white">
              {ad.title}
            </h3>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">
              {ad.placement}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {ad.startDate} → {ad.endDate}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-0.5">
              <Eye size={9} />
              {ad.impressions.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MousePointerClick size={9} />
              {ad.clicks.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <TrendingUp size={9} />
              {ctr}% CTR
            </span>
            <span className="text-slate-600">·</span>
            <span className="truncate">{ad.pages.join(", ")}</span>
          </div>
        </div>
      </button>

      <div className="flex gap-1.5 border-t border-slate-700 px-3 py-2">
        <button
          type="button"
          onClick={toggleActive}
          disabled={busy}
          className={clsx(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium",
            ad.active
              ? "bg-slate-900 text-slate-300 active:bg-slate-800"
              : "bg-emerald-500 text-white active:bg-emerald-600"
          )}
        >
          {ad.active ? <EyeOff size={11} /> : <Eye size={11} />}
          {ad.active ? "Pause" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onToggleEdit}
          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300 active:bg-slate-800"
        >
          <Pencil size={11} />
          {editing ? "Close edit" : "Edit"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label="Delete"
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 active:bg-slate-800 active:text-red-300"
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Trash2 size={12} />
          )}
        </button>
      </div>

      {editing && (
        <div className="border-t border-slate-700 p-3">
          <AdForm
            token={token}
            existing={ad}
            onSaved={async () => {
              onToggleEdit();
              await onChanged();
            }}
          />
        </div>
      )}
    </article>
  );
}

function StatusBadge({
  status,
}: {
  status: "live" | "scheduled" | "expired" | "off";
}) {
  const cls =
    status === "live"
      ? "bg-emerald-500 text-white"
      : status === "scheduled"
        ? "bg-amber-500 text-white"
        : status === "expired"
          ? "bg-slate-600 text-slate-100"
          : "bg-slate-700 text-slate-300";
  const label =
    status === "live"
      ? "LIVE"
      : status === "scheduled"
        ? "SCHEDULED"
        : status === "expired"
          ? "EXPIRED"
          : "OFF";
  return (
    <span
      className={clsx(
        "rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
        cls
      )}
    >
      {label}
    </span>
  );
}

function Stat({
  value,
  label,
  icon: Icon,
  tint,
}: {
  value: number;
  label: string;
  icon: typeof Eye;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div
        className={clsx(
          "mb-1 flex h-7 w-7 items-center justify-center rounded-full",
          tint
        )}
      >
        <Icon size={14} />
      </div>
      <p className="text-lg font-bold leading-tight tabular-nums text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

// ── Ad form (create or edit) ────────────────────────────────────────────────

function AdForm({
  token,
  existing,
  onSaved,
}: {
  token: string | null;
  existing?: Ad;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = !!existing;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? "");
  const [linkUrl, setLinkUrl] = useState(existing?.linkUrl ?? "");
  const [placement, setPlacement] = useState<Placement>(
    existing?.placement ?? "top"
  );
  const [pages, setPages] = useState<string[]>(existing?.pages ?? ["news"]);
  const [startDate, setStartDate] = useState(
    existing?.startDate ?? isoToday()
  );
  const [endDate, setEndDate] = useState(
    existing?.endDate ?? addDaysIso(isoToday(), 30)
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  function togglePage(p: string) {
    setPages((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleFile(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Upload failed");
        return;
      }
      const data = await res.json();
      if (data?.url) setImageUrl(data.url);
    } catch {
      setErr("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setErr(null);
    if (!title.trim() || !imageUrl.trim() || !linkUrl.trim()) {
      setErr("Title, image, and link URL are required.");
      return;
    }
    if (pages.length === 0) {
      setErr("Pick at least one page.");
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      setErr("End date must be on or after start date.");
      return;
    }

    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/ads/${existing!.id}` : "/api/admin/ads";
      const method = isEdit ? "PATCH" : "POST";
      const res = await apiFetch(url, {
        method,
        token,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          imageUrl: imageUrl.trim(),
          linkUrl: linkUrl.trim(),
          placement,
          pages,
          startDate,
          endDate,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Could not save");
        return;
      }
      await onSaved();
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-700/50 bg-slate-800/80 p-3">
      {/* Image upload */}
      <div>
        <Label>Banner image</Label>
        {imageUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="preview"
              className="h-32 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
              aria-label="Clear image"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/60 text-slate-400 active:bg-slate-800"
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-xs">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus size={20} />
                <span className="text-xs">Tap to pick image</span>
                <span className="text-[10px] text-slate-500">
                  JPEG/PNG/WebP/GIF, ≤5MB
                </span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {/* Manual URL fallback */}
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="…or paste a public image URL"
          className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-[12px] text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      </div>

      <Input label="Headline" value={title} onChange={setTitle} />
      <Input
        label="Description"
        value={description}
        onChange={setDescription}
        placeholder="Optional sub-text"
      />
      <Input
        label="Click-through URL"
        value={linkUrl}
        onChange={setLinkUrl}
        placeholder="https://…"
        type="url"
        icon={ExternalLink}
      />

      <div>
        <Label>Placement</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {PLACEMENT_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPlacement(p.value)}
              className={clsx(
                "rounded-xl px-3 py-2 text-xs font-medium",
                placement === p.value
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-900 text-slate-300 active:bg-slate-800"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Show on pages</Label>
        <div className="flex flex-wrap gap-1.5">
          {PAGE_OPTIONS.map((p) => {
            const sel = pages.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePage(p)}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
                  sel
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-900 text-slate-300 active:bg-slate-800"
                )}
              >
                {sel ? <Check size={9} /> : <CircleDot size={9} />}
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Start date</Label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <div>
          <Label>End date</Label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
          />
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-1.5 text-[11px] text-red-200">
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={saving || uploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Check size={14} />
        )}
        {isEdit ? "Save changes" : "Create ad"}
      </button>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: typeof ExternalLink;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {Icon ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3">
          <Icon size={14} className="text-slate-500" />
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      )}
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

// ── Helpers ────────────────────────────────────────────────────────────────

function statusOf(ad: Ad): "live" | "scheduled" | "expired" | "off" {
  if (!ad.active) return "off";
  const today = isoToday();
  if (ad.startDate > today) return "scheduled";
  if (ad.endDate < today) return "expired";
  return "live";
}

function isoToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysIso(ymd: string, days: number): string {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
