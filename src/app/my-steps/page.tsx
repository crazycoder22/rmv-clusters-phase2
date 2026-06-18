"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import { Activity, Calendar, Flame, Target, TrendingUp } from "lucide-react";

type StepsResponse = {
  days: { date: string; steps: number }[];
  today: number;
  total: number;
  average: number;
  best: number;
  streak: number;
  goal: number;
  daysTracked: number;
  source: string | null;
};

const WINDOW_DAYS = 30;

export default function MyStepsPage() {
  const { status } = useSession();
  const [data, setData] = useState<StepsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalDraft, setGoalDraft] = useState("");

  useRequireSignIn(status);

  const load = useCallback(async () => {
    const r = await fetch(`/api/me/steps?days=${WINDOW_DAYS}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  async function saveGoal() {
    const n = Math.max(0, Math.min(200000, parseInt(goalDraft, 10) || 0));
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyStepGoal: n }),
    });
    setGoalDraft("");
    await load();
  }

  const dayRows = useMemo(() => {
    const map = new Map((data?.days ?? []).map((d) => [d.date, d.steps]));
    const rows: { iso: string; steps: number }[] = [];
    const t = new Date();
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d = new Date(t);
      d.setDate(d.getDate() - i);
      const iso = isoDate(d);
      rows.push({ iso, steps: map.get(iso) ?? 0 });
    }
    return rows;
  }, [data]);
  const maxSteps = Math.max(...dayRows.map((d) => d.steps), 1);
  const todayStr = isoDate(new Date());
  const goal = data?.goal ?? 0;
  const today = data?.today ?? 0;
  const goalPct = goal > 0 ? Math.min(100, Math.round((today / goal) * 100)) : 0;

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My steps</h1>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Your daily activity · last {WINDOW_DAYS} days
      </p>

      {/* Today + streak */}
      <section className="mt-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gradient-to-br from-indigo-50 to-emerald-50 dark:from-indigo-900/20 dark:to-emerald-900/20 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Today</p>
            <p className="mt-0.5 text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{today.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500"><Activity size={12} className="-mt-0.5 mr-0.5 inline" /> steps</p>
          </div>
          {(data?.streak ?? 0) > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1 text-orange-600 dark:text-orange-300">
              <Flame size={15} /> <span className="text-sm font-bold">{data?.streak}</span>
              <span className="text-[11px]">day streak</span>
            </div>
          )}
        </div>
        {goal > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-gray-500">
              <span>Goal {goal.toLocaleString()}</span><span>{goalPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div className={goalPct >= 100 ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-indigo-500"} style={{ width: `${Math.max(2, goalPct)}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="mt-3 grid grid-cols-3 gap-2">
        <Stat value={data?.average ?? 0} label="avg / day" icon={TrendingUp} />
        <Stat value={data?.best ?? 0} label="best day" icon={Activity} />
        <Stat value={data?.total ?? 0} label={`${WINDOW_DAYS}-day total`} icon={Calendar} />
      </section>

      {/* Goal editor */}
      <section className="mt-3 flex items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <Target size={16} className="text-indigo-500" />
        <span className="text-sm text-gray-700 dark:text-gray-200">Daily goal</span>
        <input
          inputMode="numeric"
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value.replace(/\D/g, ""))}
          placeholder={goal > 0 ? goal.toLocaleString() : "e.g. 8000"}
          className="ml-auto w-28 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-right text-sm text-gray-900 dark:text-gray-100"
        />
        <button onClick={() => void saveGoal()} disabled={!goalDraft} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Set</button>
      </section>

      {/* History */}
      <section className="mt-5">
        <h2 className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400"><Calendar size={12} /> Daily history</h2>
        <div className="space-y-0.5">
          {dayRows.map((d, i) => {
            const isToday = d.iso === todayStr;
            const widthPct = (d.steps / maxSteps) * 100;
            return (
              <div key={d.iso} className={"flex items-center gap-3 rounded-lg px-2 py-1.5 " + (isToday ? "bg-indigo-50 dark:bg-indigo-900/20" : i % 2 === 0 ? "bg-gray-50 dark:bg-gray-800/40" : "")}>
                <div className="w-20 flex-shrink-0 text-xs font-medium text-gray-600 dark:text-gray-300">{isToday ? "Today" : fmtShortDate(d.iso)}</div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-900">
                    <div className={"h-full rounded-full " + (d.steps === 0 ? "bg-gray-300 dark:bg-gray-700" : goal > 0 && d.steps >= goal ? "bg-emerald-500" : d.steps >= 10000 ? "bg-emerald-500" : d.steps >= 5000 ? "bg-amber-500" : "bg-gray-400")} style={{ width: `${Math.max(2, widthPct)}%` }} />
                  </div>
                </div>
                <span className={"w-16 flex-shrink-0 text-right font-mono text-xs tabular-nums " + (d.steps === 0 ? "text-gray-400" : "text-gray-900 dark:text-gray-100")}>{d.steps > 0 ? d.steps.toLocaleString() : "—"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-5 text-center text-[11px] text-gray-400">
        Steps are recorded by the OneRMV app on your phone (Apple Health / iPhone motion / Health Connect).
      </p>
    </div>
  );
}

function Stat({ value, label, icon: Icon }: { value: number; label: string; icon: typeof Activity }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <Icon size={12} className="mb-0.5 text-gray-400" />
      <p className="text-base font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{value.toLocaleString()}</p>
      <p className="text-[9px] uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
