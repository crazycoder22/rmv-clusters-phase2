import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import Icon from "../components/Icon";
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
    await apiFetch("/api/me", { method: "PATCH", token, body: JSON.stringify({ stepSource: next }) });
    setSyncing(true);
    const res = await syncPersonalSteps({ token, source: next, force: true });
    if (res.ok) await load();
    setSyncing(false);
  }

  async function saveGoal() {
    const n = Math.max(0, Math.min(200000, parseInt(goalDraft, 10) || 0));
    await updateUser({ dailyStepGoal: n });
    await apiFetch("/api/me", { method: "PATCH", token, body: JSON.stringify({ dailyStepGoal: n }) });
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
  const streak = data?.streak ?? 0;

  // Bar fill colour per the design — goal ratio when a goal is set, else
  // absolute thresholds. Green at/above goal, warning past 60%, muted else.
  function barColor(steps: number): string {
    if (steps === 0) return "var(--text-3)";
    if (goal > 0) {
      const r = steps / goal;
      return r >= 1 ? "var(--success)" : r >= 0.6 ? "var(--warning)" : "var(--text-3)";
    }
    return steps >= 10000 ? "var(--success)" : steps >= 5000 ? "var(--warning)" : "var(--text-3)";
  }

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-start gap-3.5 py-3">
        <Link to="/community" className="mt-0.5 flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>My steps</h1>
          <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--text-3)" }}>
            {data?.source ? SOURCE_LABEL[data.source as StepSource] ?? data.source : "Personal tracker"} · last {WINDOW_DAYS} days
          </p>
        </div>
        {native && (
          <button type="button" onClick={() => void doSync()} disabled={syncing} aria-label="Sync now" className="mt-0.5 flex active:opacity-70 disabled:opacity-50">
            {syncing ? <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-2)" }} /> : <Icon name="refresh" size={22} style={{ color: "var(--text-2)" }} />}
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
      ) : (
        <>
          {/* Today hero */}
          <div className="relative overflow-hidden rounded-[20px] p-[18px]" style={{ background: "linear-gradient(150deg, #16314a 0%, #10243a 48%, #0f2e2a 100%)", border: "1px solid var(--border-strong)" }}>
            <div className="flex items-start justify-between gap-2.5">
              <span className="one-mono text-[11px] font-semibold" style={{ color: "#9fb8c9", letterSpacing: "0.14em" }}>TODAY</span>
              {streak > 0 && (
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: "rgba(245,158,11,0.16)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  <span className="text-[14px] leading-none">🔥</span>
                  <span className="text-[13px] font-extrabold" style={{ color: "#f59e0b" }}>{streak}</span>
                  <span className="text-[13px] font-semibold" style={{ color: "#e7b98a" }}>day streak</span>
                </div>
              )}
            </div>
            <div className="mt-2 text-[48px] font-extrabold leading-[1.04] tracking-tight text-white">{today.toLocaleString("en-IN")}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <Icon name="monitoring" size={18} style={{ color: "#9fb8c9" }} />
              <span className="text-[15px]" style={{ color: "#bcccdb" }}>steps</span>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="mt-3 flex gap-2.5">
            <Stat ms="trending_up" value={data?.average ?? 0} label="AVG / DAY" />
            <Stat ms="monitoring" value={data?.best ?? 0} label="BEST DAY" />
            <Stat ms="calendar_month" value={data?.total ?? 0} label={`${WINDOW_DAYS}-DAY TOTAL`} />
          </div>

          {/* Step source */}
          {native && sources.length > 0 && (
            <>
              <p className="one-mono mb-3 mt-[22px] px-1 text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>STEP SOURCE</p>
              <div className="flex gap-2.5">
                {sources.map((s) => {
                  const on = s === source;
                  return (
                    <button
                      key={s}
                      onClick={() => void pickSource(s)}
                      className="rounded-full px-4 py-2.5 text-[14.5px] font-bold"
                      style={on
                        ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 6px 16px var(--accent-soft)" }
                        : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border-strong)" }}
                    >
                      {SOURCE_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Daily goal */}
          <div className="mt-[18px] flex items-center gap-3 rounded-[16px] p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Icon name="target" size={24} fill style={{ color: "var(--accent)" }} />
            <span className="flex-1 text-[16px] font-bold" style={{ color: "var(--text)" }}>Daily goal</span>
            <input
              inputMode="numeric"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveGoal(); } }}
              placeholder={goal > 0 ? goal.toLocaleString("en-IN") : "e.g. 8000"}
              className="w-[88px] rounded-[10px] px-2 py-2.5 text-center text-[14px] outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
            />
            <button onClick={() => void saveGoal()} disabled={!goalDraft} className="rounded-[10px] px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>Set</button>
          </div>
          <p className="mx-1 mt-2 text-[12px]" style={{ color: "var(--text-3)" }}>
            Goal: <span className="font-bold" style={{ color: "var(--text-2)" }}>{(goal || 0).toLocaleString("en-IN")}</span> steps · bars turn <span className="font-bold" style={{ color: "var(--success)" }}>green</span> when you hit it.
          </p>

          {note && <p className="mt-3 rounded-[12px] px-3.5 py-2.5 text-[12px]" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>{note}</p>}

          {/* Daily history */}
          <div className="mx-1 mb-3 mt-[22px] flex items-center gap-2" style={{ color: "var(--text-3)" }}>
            <Icon name="calendar_today" size={16} style={{ color: "var(--text-3)" }} />
            <span className="one-mono text-[11px] font-semibold" style={{ letterSpacing: "0.12em" }}>DAILY HISTORY</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {dayRows.map((d) => {
              const isToday = d.iso === todayStr;
              const widthPct = Math.max(6, Math.round((d.steps / maxSteps) * 100));
              return (
                <div key={d.iso} className="flex items-center gap-3 rounded-[11px] px-3 py-2.5" style={isToday ? { background: "var(--accent-soft)" } : undefined}>
                  <span className="w-[84px] flex-shrink-0 text-[14px]" style={{ color: isToday ? "var(--text)" : "var(--text-2)", fontWeight: isToday ? 700 : 600 }}>
                    {isToday ? "Today" : fmtShortDate(d.iso)}
                  </span>
                  <div className="h-[11px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                    <div className="h-full rounded-full" style={{ width: `${widthPct}%`, background: barColor(d.steps) }} />
                  </div>
                  <span className="w-[58px] flex-shrink-0 text-right text-[14px] font-bold tabular-nums" style={{ color: d.steps === 0 ? "var(--text-3)" : "var(--text)" }}>
                    {d.steps > 0 ? d.steps.toLocaleString("en-IN") : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="pt-4 text-center text-[11px]" style={{ color: "var(--text-3)" }}>
            {native ? "Tap ↻ to sync the latest from your device." : "Steps sync from the OneRMV app on your phone."}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ ms, value, label }: { ms: string; value: number; label: string }) {
  return (
    <div className="flex-1 rounded-[15px] p-[13px_11px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <Icon name={ms} size={18} style={{ color: "var(--text-3)" }} />
      <p className="mt-2 text-[19px] font-extrabold tracking-tight tabular-nums" style={{ color: "var(--text)" }}>{value.toLocaleString("en-IN")}</p>
      <p className="mt-0.5 text-[10.5px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.05em" }}>{label}</p>
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
