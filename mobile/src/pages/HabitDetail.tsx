import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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

  const doneSet = useMemo(() => new Set(habit?.checkinDates ?? []), [habit?.checkinDates]);

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
        ? await apiFetch(`/api/habits/${id}/checkin?date=${iso}`, { method: "DELETE", token })
        : await apiFetch(`/api/habits/${id}/checkin`, { method: "POST", token, body: JSON.stringify({ date: iso }) });
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
      const res = await apiFetch(`/api/habits/${id}`, { method: "DELETE", token });
      if (res.ok) navigate("/habits", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>;
  }

  if (error || !habit) {
    return (
      <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <header className="flex items-center gap-3.5 py-3">
          <Link to="/habits" className="flex active:opacity-70" aria-label="Back"><Icon name="arrow_back" size={24} style={{ color: "var(--text)" }} /></Link>
          <h1 className="text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Habit</h1>
        </header>
        <p className="rounded-[12px] px-4 py-3 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error ?? "Not found"}</p>
      </div>
    );
  }

  const isOwner = habit.role === "owner";

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <header className="flex items-start gap-3.5 py-3">
        <Link to="/habits" className="mt-0.5 flex active:opacity-70" aria-label="Back"><Icon name="arrow_back" size={24} style={{ color: "var(--text)" }} /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[21px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>{habit.emoji ? `${habit.emoji} ` : ""}{habit.title}</h1>
          <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--text-3)" }}>
            {fmtDate(habit.startDate)} – {fmtDate(habit.endDate)}
            {habit.targetMinutes ? ` · ${habit.targetMinutes} min/day` : ""}
            {!isOwner && ` · ${habit.owner.name}'s habit`}
          </p>
        </div>
        {isOwner && (
          <button type="button" onClick={remove} disabled={busy} aria-label="Delete" className="mt-0.5 flex active:opacity-70">
            <Icon name="delete" size={22} style={{ color: "var(--text-2)" }} />
          </button>
        )}
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={habit.currentStreak} label="DAY STREAK" ms="local_fire_department" tint="var(--flame)" />
        <Stat value={habit.longestStreak} label="BEST STREAK" ms="trophy" tint="var(--gold)" />
        <Stat value={habit.completionPct} label="COMPLETE" ms="target" tint="var(--target)" suffix="%" />
      </div>

      {/* Mark today (owner only) */}
      {isOwner && habit.today >= habit.startDate && habit.today <= habit.endDate && (
        <button
          type="button"
          onClick={() => toggle(habit.today)}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-[15px] py-4 text-[17px] font-bold"
          style={habit.todayDone
            ? { background: "var(--success-soft)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 40%, transparent)" }
            : { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 8px 20px var(--accent-soft)" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon name="check_circle" size={22} fill={habit.todayDone} style={{ color: habit.todayDone ? "var(--success)" : "#fff" }} />}
          {habit.todayDone ? "Done today · tap to undo" : "Mark today done"}
        </button>
      )}

      {/* Nudge (partner only) */}
      {!isOwner && (
        <button
          type="button"
          onClick={nudge}
          disabled={busy || !habit.canNudge}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-[15px] py-4 text-[16px] font-bold"
          style={habit.canNudge ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 8px 20px var(--accent-soft)" } : { background: "var(--surface-2)", color: "var(--text-3)" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon name="notifications" size={20} style={{ color: habit.canNudge ? "#fff" : "var(--text-3)" }} />}
          {habit.canNudge ? "Send a nudge" : "Nudged recently — try later"}
        </button>
      )}

      {/* Day grid */}
      <p className="one-mono mt-5 text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>{isOwner ? "TAP A DAY TO MARK" : "PROGRESS"}</p>
      <div className="mt-3 grid grid-cols-7 gap-[7px]">
        {days.map((d) => {
          const done = doneSet.has(d.iso);
          const isToday = d.iso === habit.today;
          const numColor = done ? "#fff" : isToday ? "var(--text)" : d.inFuture ? "var(--text-3)" : "var(--text-2)";
          const monColor = done ? "rgba(255,255,255,0.7)" : "var(--text-3)";
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => toggle(d.iso)}
              disabled={!isOwner || d.inFuture || busy}
              className="flex h-[56px] flex-col items-center justify-center gap-0.5 rounded-[12px]"
              style={{
                background: done ? "var(--accent-strong)" : isToday ? "var(--surface-3)" : "var(--surface-2)",
                border: done ? "1px solid var(--accent-strong)" : isToday ? "1.5px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              <span className="text-[15px] font-bold" style={{ color: numColor }}>{dayNum(d.iso)}</span>
              <span className="one-mono text-[8px] uppercase" style={{ color: monColor, letterSpacing: "0.05em" }}>{monthAbbr(d.iso)}</span>
            </button>
          );
        })}
      </div>

      {/* Accountability */}
      <p className="one-mono mt-5 text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>ACCOUNTABILITY</p>
      <div className="mt-3 rounded-[16px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {isOwner ? (
          habit.partner ? (
            <div className="flex items-center gap-2.5">
              <Icon name="auto_awesome" size={22} style={{ color: "var(--accent)" }} />
              <span className="text-[16px] font-bold" style={{ color: "var(--text)" }}>{habit.partner.name}</span>
              <StatusPill status={habit.partner.status} />
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>No partner yet. Add one when you create a habit, or they can cheer you on once invited.</p>
          )
        ) : (
          <p className="text-[13px]" style={{ color: "var(--text-3)" }}>You're keeping {habit.owner.name} accountable. Send a nudge if they haven't marked today.</p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Stat({ value, label, ms, tint, suffix = "" }: { value: number; label: string; ms: string; tint: string; suffix?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[16px] px-1.5 py-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <Icon name={ms} size={24} fill style={{ color: tint }} />
      <p className="text-[24px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>{value}{suffix}</p>
      <p className="one-mono text-[9px] uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.08em" }}>{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const accepted = status === "accepted";
  const pending = status === "pending";
  return (
    <span
      className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase"
      style={{
        letterSpacing: "0.04em",
        background: accepted ? "var(--success-soft)" : pending ? "var(--warning-soft)" : "var(--surface-2)",
        color: accepted ? "var(--success)" : pending ? "var(--warning)" : "var(--text-2)",
      }}
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
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
