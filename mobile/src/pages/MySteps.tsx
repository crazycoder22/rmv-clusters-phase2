import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Flame,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { Capacitor } from "@capacitor/core";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import {
  syncPersonalSteps,
  availableSources,
  defaultStepSource,
  type StepSource,
} from "../lib/personalSteps";

// Always-on personal step tracker. Server (/api/me/steps) is the source of
// truth; the device sources (Apple Health / iPhone motion / Health Connect)
// feed it via PersonalStepSyncMount and the "Sync now" button here.

const WINDOW_DAYS = 30;

const SOURCE_LABEL: Record<StepSource, string> = {
  apple_health: "Apple Health",
  core_motion: "iPhone motion",
  health_connect: "Health Connect",
};

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

export default function MySteps() {
  const { token, user, updateUser } = useAuth();
  const native = Capacitor.isNativePlatform();

  const [data, setData] = useState<StepsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sources, setSources] = useState<StepSource[]>([]);
  const [goalDraft, setGoalDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const source: StepSource =
    (user?.stepSource as StepSource | undefined) ?? defaultStepSource();

  const load = useCallback(async () => {
    if (!token) return;
    const r = await apiFetch(`/api/me/steps?days=${WINDOW_DAYS}`, { token });
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (native) void availableSources().then(setSources);
  }, [native]);

  async function doSync() {
    if (!native || syncing) return;
    setSyncing(true);
    setNote(null);
    const res = await syncPersonalSteps({ token, source, force: true });
    if (res.ok) await load();
    else if (res.reason === "none")
      setNote("No step data from your source yet. Make sure access is allowed.");
    setSyncing(false);
  }

  async function pickSource(next: StepSource) {
    if (next === source) return;
    await updateUser({ stepSource: next });
    await apiFetch("/api/me", {
      method: "PATCH",
      token,
      body: JSON.stringify({ stepSource: next }),
    });
    // Sync immediately from the new source.
    setSyncing(true);
    const res = await syncPersonalSteps({ token, source: next, force: true });
    if (res.ok) await load();
    setSyncing(false);
  }

  async function saveGoal() {
    const n = Math.max(0, Math.min(200000, parseInt(goalDraft, 10) || 0));
    await updateUser({ dailyStepGoal: n });
    await apiFetch("/api/me", {
      method: "PATCH",
      token,
      body: JSON.stringify({ dailyStepGoal: n }),
    });
    setGoalDraft("");
    await load();
  }

  // 30-day rows (newest first), zero-filled.
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

  const goal = data?.goal ?? user?.dailyStepGoal ?? 0;
  const today = data?.today ?? 0;
  const goalPct = goal > 0 ? Math.min(100, Math.round((today / goal) * 100)) : 0;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link to="/more" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-white">My steps</h1>
          <p className="truncate text-[11px] text-slate-500">
            {data?.source ? SOURCE_LABEL[data.source as StepSource] ?? data.source : "Personal tracker"} · last {WINDOW_DAYS} days
          </p>
        </div>
        {native && (
          <button type="button" onClick={() => void doSync()} disabled={syncing} aria-label="Sync now" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800 disabled:opacity-50">
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500"><Loader2 size={20} className="animate-spin" /></div>
      ) : (
        <>
          {/* Today hero + streak */}
          <section className="mb-3 rounded-2xl border border-slate-700 bg-gradient-to-br from-indigo-500/15 to-emerald-500/15 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Today</p>
                <p className="mt-0.5 text-4xl font-bold tabular-nums text-white">{today.toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-slate-300"><Activity size={11} className="-mt-0.5 mr-0.5 inline" /> steps</p>
              </div>
              {(data?.streak ?? 0) > 0 && (
                <div className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-orange-300">
                  <Flame size={14} className="fill-orange-400 text-orange-400" />
                  <span className="text-sm font-bold">{data?.streak}</span>
                  <span className="text-[10px]">day streak</span>
                </div>
              )}
            </div>
            {goal > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                  <span>Goal {goal.toLocaleString()}</span>
                  <span>{goalPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                  <div className={clsx("h-full rounded-full", goalPct >= 100 ? "bg-emerald-500" : "bg-indigo-400")} style={{ width: `${Math.max(2, goalPct)}%` }} />
                </div>
              </div>
            )}
          </section>

          {/* Stats */}
          <section className="mb-3 grid grid-cols-3 gap-2">
            <Stat value={data?.average ?? 0} label="avg / day" icon={TrendingUp} />
            <Stat value={data?.best ?? 0} label="best day" icon={Activity} />
            <Stat value={data?.total ?? 0} label={`${WINDOW_DAYS}-day total`} icon={Calendar} />
          </section>

          {/* Source picker (native only) */}
          {native && sources.length > 0 && (
            <section className="mb-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Step source</p>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <button key={s} onClick={() => void pickSource(s)} className={clsx("rounded-full px-3 py-1.5 text-xs font-medium", s === source ? "bg-indigo-600 text-white" : "border border-slate-700 bg-slate-800/60 text-slate-300")}>
                    {SOURCE_LABEL[s]}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Goal editor */}
          <section className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3 py-2.5">
            <Target size={16} className="text-indigo-300" />
            <span className="text-sm text-slate-200">Daily goal</span>
            <input
              inputMode="numeric"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value.replace(/\D/g, ""))}
              placeholder={goal > 0 ? goal.toLocaleString() : "e.g. 8000"}
              className="ml-auto w-24 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-right text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            />
            <button onClick={() => void saveGoal()} disabled={!goalDraft} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Set</button>
          </section>

          {note && <p className="mb-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-1.5 text-[11px] text-amber-200">{note}</p>}

          {/* 30-day history */}
          <section className="mb-4">
            <h2 className="mb-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Calendar size={11} /> Daily history</h2>
            <div className="space-y-0.5">
              {dayRows.map((d, i) => {
                const isToday = d.iso === todayStr;
                const widthPct = (d.steps / maxSteps) * 100;
                return (
                  <div key={d.iso} className={clsx("flex items-center gap-2 rounded-lg px-2 py-1.5", isToday ? "bg-indigo-500/15" : i % 2 === 0 ? "bg-slate-800/40" : "bg-slate-800/20")}>
                    <div className="w-16 flex-shrink-0"><p className="text-[11px] font-medium text-slate-200">{isToday ? "Today" : fmtShortDate(d.iso)}</p></div>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                        <div className={clsx("h-full rounded-full", d.steps === 0 ? "bg-slate-700" : goal > 0 && d.steps >= goal ? "bg-emerald-500" : d.steps >= 10000 ? "bg-emerald-500" : d.steps >= 5000 ? "bg-amber-500" : "bg-slate-500")} style={{ width: `${Math.max(2, widthPct)}%` }} />
                      </div>
                    </div>
                    <span className={clsx("w-16 flex-shrink-0 text-right font-mono text-[11px] tabular-nums", d.steps === 0 ? "text-slate-600" : "text-white")}>{d.steps > 0 ? d.steps.toLocaleString() : "—"}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <p className="pb-4 text-center text-[10px] text-slate-500">
            {native ? "Tap ↻ to sync the latest from your device." : "Steps sync from the OneRMV app on your phone."}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ value, label, icon: Icon }: { value: number; label: string; icon: typeof Activity }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <Icon size={11} className="mb-0.5 text-slate-400" />
      <p className="text-base font-bold leading-tight tabular-nums text-white">{value.toLocaleString()}</p>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
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
