import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO
  color: string;
}

// Same 8 presets as the web admin form.
const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#f97316", label: "Orange" },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminCalendar() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/calendar", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      setEvents(data.events ?? []);
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

  async function remove(ev: CalendarEvent) {
    if (!confirm(`Delete "${ev.title}"?`)) return;
    setBusyId(ev.id);
    try {
      const res = await apiFetch(`/api/admin/calendar/${ev.id}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    } finally {
      setBusyId(null);
    }
  }

  // Group events by month for a tidy list.
  const grouped = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

  const upcomingCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter((e) => new Date(e.date) >= today).length;
  }, [events]);

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
          <h1 className="text-lg font-semibold text-white">Manage calendar</h1>
          <p className="truncate text-[11px] text-slate-500">
            {events.length} event{events.length !== 1 ? "s" : ""} ·{" "}
            {upcomingCount} upcoming
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((cur) => (cur === "new" ? null : "new"))}
          className={clsx(
            "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium",
            editing === "new"
              ? "bg-slate-800 text-slate-300"
              : "bg-indigo-500 text-white active:bg-indigo-600"
          )}
        >
          {editing === "new" ? <X size={14} /> : <Plus size={14} />}
          {editing === "new" ? "Close" : "New"}
        </button>
      </header>

      <p className="mb-3 rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2 text-[11px] text-slate-400">
        These are standalone calendar dates (holidays, maintenance, festivals).
        Announcements & meetings show on the calendar automatically.
      </p>

      {editing === "new" && (
        <EventForm
          token={token}
          onSaved={async () => {
            setEditing(null);
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
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No calendar events yet. Tap{" "}
            <span className="text-indigo-300">New</span> to add one.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([monthKey, monthEvents]) => (
              <div key={monthKey}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {fmtMonth(monthKey)}
                </h2>
                <div className="space-y-2">
                  {monthEvents.map((ev) =>
                    editing !== "new" &&
                    typeof editing === "object" &&
                    editing?.id === ev.id ? (
                      <EventForm
                        key={ev.id}
                        token={token}
                        existing={ev}
                        onSaved={async () => {
                          setEditing(null);
                          await refresh();
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <EventRow
                        key={ev.id}
                        ev={ev}
                        busy={busyId === ev.id}
                        onEdit={() => setEditing(ev)}
                        onDelete={() => remove(ev)}
                      />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EventRow({
  ev,
  busy,
  onEdit,
  onDelete,
}: {
  ev: CalendarEvent;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const d = new Date(ev.date);
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="flex w-11 flex-shrink-0 flex-col items-center">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: ev.color }}
        >
          {d.getDate()}
        </span>
        <span className="mt-0.5 text-[9px] uppercase text-slate-500">
          {d.toLocaleDateString("en-IN", { weekday: "short" })}
        </span>
      </div>
      <p className="flex-1 truncate text-sm font-semibold text-white">
        {ev.title}
      </p>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 active:bg-slate-700"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label="Delete"
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:bg-slate-800 active:text-red-300"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Trash2 size={13} />
        )}
      </button>
    </article>
  );
}

function EventForm({
  token,
  existing,
  onSaved,
  onCancel,
}: {
  token: string | null;
  existing?: CalendarEvent;
  onSaved: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const isEdit = !!existing;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(
    existing ? new Date(existing.date).toISOString().slice(0, 10) : todayIso()
  );
  const [color, setColor] = useState(existing?.color ?? "#3b82f6");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!title.trim()) {
      setErr("Title required");
      return;
    }
    if (!date) {
      setErr("Date required");
      return;
    }
    setBusy(true);
    try {
      const url = isEdit
        ? `/api/admin/calendar/${existing!.id}`
        : "/api/admin/calendar";
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        token,
        body: JSON.stringify({ title: title.trim(), date, color }),
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
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-700/50 bg-slate-800/80 p-3">
      <div>
        <Label>Title</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "Holi celebrations"'
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      </div>
      <div>
        <Label>Date</Label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none"
        />
      </div>
      <div>
        <Label>Colour</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              aria-label={c.label}
              className={clsx(
                "h-8 w-8 rounded-full border-2 transition-transform active:scale-95",
                color === c.value
                  ? "border-white"
                  : "border-transparent"
              )}
              style={{ backgroundColor: c.value }}
            >
              {color === c.value && (
                <Check size={14} className="mx-auto text-white" />
              )}
            </button>
          ))}
        </div>
      </div>
      {err && (
        <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-1.5 text-[11px] text-red-200">
          {err}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 active:bg-slate-700"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          {isEdit ? "Save" : "Add event"}
        </button>
      </div>
    </section>
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

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
