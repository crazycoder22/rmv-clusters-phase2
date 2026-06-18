"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import MyChallenge from "./MyChallenge";
import { useParams } from "next/navigation";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import Link from "next/link";
import { ArrowLeft, Flame, Target, Check, Trophy, Pencil } from "lucide-react";

interface StepEvent {
  rsvpId: string;
  announcementId: string;
  title: string;
  startDate: string;
  endDate: string;
  dailyGoal: number;
}
interface DashParticipant {
  id: string; // === rsvpId for residents
  totalSteps: number;
  dailyGoal: number;
  daysGoalMet: number;
  dailySteps: { date: string; steps: number }[];
}

export default function StepEventPage() {
  const { status } = useSession();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [event, setEvent] = useState<StepEvent | null>(null);
  const [me, setMe] = useState<DashParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  useRequireSignIn(status);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const evRes = await fetch("/api/me/step-events");
      if (!evRes.ok) { setError("Could not load"); return; }
      const ev: StepEvent | undefined = ((await evRes.json()).events ?? []).find(
        (e: StepEvent) => e.announcementId === id
      );
      if (!ev) { setError("You aren't registered for this step challenge."); return; }
      setEvent(ev);

      const dashRes = await fetch(`/api/events/${id}/dashboard`);
      if (dashRes.ok) {
        const d = await dashRes.json();
        const mine = (d.participants ?? []).find((p: DashParticipant) => p.id === ev.rsvpId) ?? null;
        setMe(mine);
      }
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void load(); }, [id, load]);

  const todayIso = useMemo(() => isoIST(), []);
  const doneMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of me?.dailySteps ?? []) m.set(d.date.slice(0, 10), d.steps);
    return m;
  }, [me]);

  const days = useMemo(() => {
    if (!event) return [];
    const out: { iso: string; isPast: boolean; isToday: boolean }[] = [];
    let cur = event.startDate.slice(0, 10);
    let guard = 0;
    while (cur <= event.endDate.slice(0, 10) && guard < 60) {
      out.push({ iso: cur, isPast: cur < todayIso, isToday: cur === todayIso });
      cur = addDays(cur, 1); guard++;
    }
    return out;
  }, [event, todayIso]);

  async function saveSteps(dateIso: string, steps: number) {
    if (!event) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.announcementId}/my-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [{ date: dateIso, steps }] }),
      });
      if (res.ok) { setEditing(null); setEditVal(""); await load(); }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Centered><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></Centered>;
  if (error || !event) return <Centered><div className="text-center"><p className="text-red-600 mb-3">{error ?? "Not found"}</p><Link href="/" className="text-blue-600 text-sm">← Home</Link></div></Centered>;

  const goal = event.dailyGoal;
  const total = me?.totalSteps ?? 0;
  const daysMet = me?.daysGoalMet ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between">
          <Link href={`/events/${id}/dashboard`} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> Leaderboard</Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3">🏃 {event.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(event.startDate)} – {fmtDate(event.endDate)}{goal > 0 ? ` · goal ${goal.toLocaleString()}/day` : ""}</p>

        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2.5 mt-4">
          On the web you enter steps manually. The iPhone app syncs them automatically from Apple Health.
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <Stat value={total} label="total steps" icon={Flame} color="text-orange-600" />
          <Stat value={daysMet} label="days met" icon={Check} color="text-green-600" />
          <Stat value={goal} label="daily goal" icon={Target} color="text-blue-600" />
        </div>

        <MyChallenge eventId={event.announcementId} />

        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">Daily steps</h2>
        <div className="space-y-1.5">
          {days.map((d) => {
            const steps = doneMap.get(d.iso) ?? 0;
            const met = goal > 0 && steps >= goal;
            const isEditing = editing === d.iso;
            return (
              <div key={d.iso} className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${d.isToday ? "border-blue-300 bg-blue-50 dark:bg-blue-900/30" : met ? "border-green-200 bg-white dark:bg-gray-800" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
                <div className="w-20 flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmtShort(d.iso)}</p>
                  {d.isToday && <p className="text-[10px] uppercase text-blue-600">today</p>}
                </div>
                {isEditing ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)} autoFocus placeholder="steps" className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={() => saveSteps(d.iso, parseInt(editVal, 10) || 0)} disabled={saving} className="bg-green-600 text-white rounded-md px-3 py-1 text-xs font-semibold hover:bg-green-700">Save</button>
                    <button type="button" onClick={() => { setEditing(null); setEditVal(""); }} className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-xs">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${steps === 0 ? "text-gray-400 dark:text-gray-500" : met ? "text-green-600" : "text-gray-900 dark:text-gray-100"}`}>{steps > 0 ? steps.toLocaleString() : "—"}</p>
                    </div>
                    {(d.isPast || d.isToday) && (
                      <button type="button" onClick={() => { setEditing(d.iso); setEditVal(String(steps || "")); }} className="text-gray-400 dark:text-gray-500 hover:text-gray-700"><Pencil size={14} /></button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <Link href={`/events/${id}/dashboard`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"><Trophy size={15} /> View community leaderboard</Link>
      </div>
    </div>
  );
}

function Stat({ value, label, icon: Icon, color }: { value: number; label: string; icon: typeof Flame; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
      <Icon size={18} className={`mx-auto mb-1 ${color}`} />
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">{children}</div>; }
function isoIST(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00+05:30"); d.setUTCDate(d.getUTCDate() + n); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
function fmtDate(iso: string): string { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
function fmtShort(iso: string): string { return new Date(iso + "T00:00:00+05:30").toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric" }); }
