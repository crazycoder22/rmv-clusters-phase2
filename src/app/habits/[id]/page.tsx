"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  Trophy,
  Target,
  Bell,
  Check,
  Trash2,
  Sparkles,
} from "lucide-react";

interface HabitDetailData {
  id: string;
  role: "owner" | "partner";
  title: string;
  emoji: string | null;
  targetMinutes: number | null;
  startDate: string;
  endDate: string;
  today: string;
  todayDone: boolean;
  currentStreak: number;
  longestStreak: number;
  completionPct: number;
  checkinDates: string[];
  owner: { name: string; block: number; flatNumber: string };
  partner: { id: string; name: string; status: string } | null;
  canNudge: boolean;
}

export default function HabitDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [habit, setHabit] = useState<HabitDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/habits/${id}`);
      if (!res.ok) { setError(res.status === 404 ? "Habit not found" : "Could not load"); return; }
      setHabit(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  const doneSet = useMemo(() => new Set(habit?.checkinDates ?? []), [habit?.checkinDates]);
  const days = useMemo(() => {
    if (!habit) return [];
    const out: { iso: string; inFuture: boolean }[] = [];
    let cursor = habit.startDate; let guard = 0;
    while (cursor <= habit.endDate && guard < 400) { out.push({ iso: cursor, inFuture: cursor > habit.today }); cursor = addDays(cursor, 1); guard++; }
    return out;
  }, [habit]);

  async function api(path: string, method: string, body?: unknown) {
    return fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  }
  async function toggle(iso: string) {
    if (!habit || habit.role !== "owner" || iso > habit.today) return;
    setBusy(true);
    try {
      const res = doneSet.has(iso) ? await api(`/api/habits/${id}/checkin?date=${iso}`, "DELETE") : await api(`/api/habits/${id}/checkin`, "POST", { date: iso });
      if (res.ok) await refresh();
    } finally { setBusy(false); }
  }
  async function nudge() { setBusy(true); try { await api(`/api/habits/${id}/nudge`, "POST"); await refresh(); } finally { setBusy(false); } }
  async function remove() {
    if (!habit || !confirm(`Delete "${habit.title}"?`)) return;
    setBusy(true);
    try { const res = await api(`/api/habits/${id}`, "DELETE"); if (res.ok) router.push("/habits"); } finally { setBusy(false); }
  }

  if (loading) return <Centered><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></Centered>;
  if (error || !habit) return <Centered><div className="text-center"><p className="text-red-600 mb-3">{error ?? "Not found"}</p><Link href="/habits" className="text-blue-600 text-sm">← Back to Habits</Link></div></Centered>;

  const isOwner = habit.role === "owner";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between">
          <Link href="/habits" className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> Back to Habits</Link>
          {isOwner && <button type="button" onClick={remove} disabled={busy} className="text-gray-400 dark:text-gray-500 hover:text-red-600"><Trash2 size={18} /></button>}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3">{habit.emoji ? `${habit.emoji} ` : ""}{habit.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {fmtDate(habit.startDate)} – {fmtDate(habit.endDate)}{habit.targetMinutes ? ` · ${habit.targetMinutes} min/day` : ""}{!isOwner && ` · ${habit.owner.name}'s habit`}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat value={habit.currentStreak} label="day streak" icon={Flame} color="text-orange-600" />
          <Stat value={habit.longestStreak} label="best streak" icon={Trophy} color="text-amber-600" />
          <Stat value={habit.completionPct} label="complete" icon={Target} color="text-green-600" suffix="%" />
        </div>

        {isOwner && habit.today >= habit.startDate && habit.today <= habit.endDate && (
          <button type="button" onClick={() => toggle(habit.today)} disabled={busy} className={`w-full mt-4 inline-flex items-center justify-center gap-2 rounded-lg py-3 font-medium ${habit.todayDone ? "bg-green-100 text-green-700" : "bg-blue-600 text-white hover:bg-blue-700"} disabled:opacity-50`}>
            <Check size={16} /> {habit.todayDone ? "Done today ✓ (click to undo)" : "Mark today done"}
          </button>
        )}
        {!isOwner && (
          <button type="button" onClick={nudge} disabled={busy || !habit.canNudge} className={`w-full mt-4 inline-flex items-center justify-center gap-2 rounded-lg py-3 font-medium ${habit.canNudge ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"}`}>
            <Bell size={16} /> {habit.canNudge ? "Send a nudge" : "Nudged recently — try later"}
          </button>
        )}

        {/* Day grid */}
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">{isOwner ? "Click a day to mark" : "Progress"}</h2>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const done = doneSet.has(d.iso); const isToday = d.iso === habit.today;
            return (
              <button key={d.iso} type="button" onClick={() => toggle(d.iso)} disabled={!isOwner || d.inFuture || busy}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs ${done ? "bg-green-600 text-white" : d.inFuture ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"} ${isToday ? "ring-2 ring-blue-500" : ""}`}>
                <span className="font-semibold">{dayNum(d.iso)}</span>
                <span className="text-[9px] uppercase opacity-70">{monthAbbr(d.iso)}</span>
              </button>
            );
          })}
        </div>

        {/* Partner */}
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">Accountability</h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm">
          {isOwner ? (
            habit.partner ? (
              <p className="inline-flex items-center gap-2 text-gray-800 dark:text-gray-200"><Sparkles size={15} className="text-blue-600" /> {habit.partner.name}
                <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${habit.partner.status === "accepted" ? "bg-green-100 text-green-700" : habit.partner.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>{habit.partner.status}</span>
              </p>
            ) : <p className="text-gray-500 dark:text-gray-400">No partner yet. Add one when creating a habit on the app, or they can cheer you on once invited.</p>
          ) : <p className="text-gray-500 dark:text-gray-400">You&apos;re keeping {habit.owner.name} accountable. Send a nudge if they haven&apos;t marked today.</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, icon: Icon, color, suffix = "" }: { value: number; label: string; icon: typeof Flame; color: string; suffix?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
      <Icon size={18} className={`mx-auto mb-1 ${color}`} />
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}{suffix}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">{children}</div>;
}
function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dayNum(iso: string): string { return String(parseInt(iso.slice(8, 10), 10)); }
function monthAbbr(iso: string): string { return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(iso.slice(5, 7), 10) - 1]; }
function fmtDate(iso: string): string { return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
