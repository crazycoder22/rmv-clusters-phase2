import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Flame,
  Loader2,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

// ── Types ──────────────────────────────────────────────────────────────────

interface HabitDetailData {
  id: string;
  role: "owner" | "partner";
  title: string;
  emoji: string | null;
  targetMinutes: number | null;
  startDate: string;
  endDate: string;
  active: boolean;
  today: string;
  todayDone: boolean;
  currentStreak: number;
  longestStreak: number;
  totalDone: number;
  completionPct: number;
  checkinDates: string[];
  owner: { name: string; block: number; flatNumber: string };
  partner: { id: string; name: string; status: string } | null;
  canNudge: boolean;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function HabitDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [habit, setHabit] = useState<HabitDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/habits/${id}`, { token });
      if (!res.ok) {
        setError(res.status === 404 ? "Habit not found" : "Could not load");
        return;
      }
      setHabit(await res.json());
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doneSet = useMemo(
    () => new Set(habit?.checkinDates ?? []),
    [habit?.checkinDates]
  );

  // Build the day grid over [startDate, endDate].
  const days = useMemo(() => {
    if (!habit) return [];
    const out: { iso: string; inFuture: boolean }[] = [];
    let cursor = habit.startDate;
    let guard = 0;
    while (cursor <= habit.endDate && guard < 400) {
      out.push({ iso: cursor, inFuture: cursor > habit.today });
      cursor = addDays(cursor, 1);
      guard++;
    }
    return out;
  }, [habit]);

  async function toggle(iso: string) {
    if (!habit || habit.role !== "owner") return;
    if (iso > habit.today) return;
    setBusy(true);
    const isDone = doneSet.has(iso);
    try {
      const res = isDone
        ? await apiFetch(`/api/habits/${id}/checkin?date=${iso}`, {
            method: "DELETE",
            token,
          })
        : await apiFetch(`/api/habits/${id}/checkin`, {
            method: "POST",
            token,
            body: JSON.stringify({ date: iso }),
          });
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function nudge() {
    if (!habit) return;
    setBusy(true);
    try {
      await apiFetch(`/api/habits/${id}/nudge`, { method: "POST", token });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!habit) return;
    if (!confirm(`Delete "${habit.title}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/habits/${id}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) navigate("/habits", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (error || !habit) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
        <header className="flex items-center gap-2 py-4">
          <Link
            to="/habits"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-white">Habit</h1>
        </header>
        <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
          {error ?? "Not found"}
        </p>
      </div>
    );
  }

  const isOwner = habit.role === "owner";

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/habits"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">
            {habit.emoji ? `${habit.emoji} ` : ""}
            {habit.title}
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {fmtDate(habit.startDate)} – {fmtDate(habit.endDate)}
            {habit.targetMinutes ? ` · ${habit.targetMinutes} min/day` : ""}
            {!isOwner && ` · ${habit.owner.name}'s habit`}
          </p>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label="Delete"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-800 active:text-red-300"
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      {/* Stats */}
      <section className="mb-3 grid grid-cols-3 gap-2">
        <Stat value={habit.currentStreak} label="day streak" icon={Flame} tint="text-orange-300" />
        <Stat value={habit.longestStreak} label="best streak" icon={Trophy} tint="text-amber-300" />
        <Stat value={habit.completionPct} label="complete" icon={Target} tint="text-emerald-300" suffix="%" />
      </section>

      {/* Mark today (owner only) */}
      {isOwner && habit.today >= habit.startDate && habit.today <= habit.endDate && (
        <button
          type="button"
          onClick={() => toggle(habit.today)}
          disabled={busy}
          className={clsx(
            "mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold",
            habit.todayDone
              ? "bg-emerald-500/20 text-emerald-200"
              : "bg-indigo-500 text-white active:bg-indigo-600",
            busy && "opacity-50"
          )}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {habit.todayDone ? "Done today ✓ (tap to undo)" : "Mark today done"}
        </button>
      )}

      {/* Nudge (partner only) */}
      {!isOwner && (
        <button
          type="button"
          onClick={nudge}
          disabled={busy || !habit.canNudge}
          className={clsx(
            "mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold",
            habit.canNudge
              ? "bg-indigo-500 text-white active:bg-indigo-600"
              : "bg-slate-800 text-slate-500"
          )}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Bell size={16} />
          )}
          {habit.canNudge ? "Send a nudge" : "Nudged recently — try later"}
        </button>
      )}

      {/* Day grid */}
      <section className="mb-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {isOwner ? "Tap a day to mark" : "Progress"}
        </h2>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const done = doneSet.has(d.iso);
            const isToday = d.iso === habit.today;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => toggle(d.iso)}
                disabled={!isOwner || d.inFuture || busy}
                className={clsx(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-[10px]",
                  done
                    ? "bg-emerald-500 text-white"
                    : d.inFuture
                      ? "bg-slate-900/40 text-slate-600"
                      : "bg-slate-800 text-slate-400",
                  isToday && "ring-2 ring-indigo-400"
                )}
              >
                <span className="font-semibold">{dayNum(d.iso)}</span>
                <span className="text-[8px] uppercase opacity-70">
                  {monthAbbr(d.iso)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Partner info */}
      <section className="pb-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Accountability
        </h2>
        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
          {isOwner ? (
            habit.partner ? (
              <p className="inline-flex items-center gap-2 text-sm text-white">
                <Sparkles size={14} className="text-indigo-300" />
                {habit.partner.name}
                <StatusPill status={habit.partner.status} />
              </p>
            ) : (
              <p className="text-[12px] text-slate-400">
                No partner yet. Add one when you create a habit, or they can
                cheer you on once invited.
              </p>
            )
          ) : (
            <p className="text-[12px] text-slate-400">
              You're keeping {habit.owner.name} accountable. Send a nudge if
              they haven't marked today.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  icon: Icon,
  tint,
  suffix = "",
}: {
  value: number;
  label: string;
  icon: typeof Flame;
  tint: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3 text-center">
      <Icon size={16} className={clsx("mx-auto mb-1", tint)} />
      <p className="text-xl font-bold tabular-nums text-white">
        {value}
        {suffix}
      </p>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "accepted"
      ? "bg-emerald-500/20 text-emerald-200"
      : status === "pending"
        ? "bg-amber-500/20 text-amber-200"
        : "bg-slate-700 text-slate-300";
  return (
    <span
      className={clsx(
        "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        cls
      )}
    >
      {status}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayNum(iso: string): string {
  return String(parseInt(iso.slice(8, 10), 10));
}

function monthAbbr(iso: string): string {
  const m = parseInt(iso.slice(5, 7), 10) - 1;
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
