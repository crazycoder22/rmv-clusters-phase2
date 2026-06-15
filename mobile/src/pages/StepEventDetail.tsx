import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import MyChallengeMobile from "../components/MyChallengeMobile";
import {
  isHealthKitAvailable,
  syncStepsFromHealth,
  type SyncOutcome,
} from "../lib/healthkit";

// ── Types ──────────────────────────────────────────────────────────────────

interface StepEvent {
  rsvpId: string;
  eventConfigId: string;
  announcementId: string;
  title: string;
  summary: string;
  emoji: string | null;
  startDate: string;
  endDate: string;
  dailyGoalString: string;
  dailyGoal: number;
  rsvpCreatedAt: string;
}

interface DashboardParticipant {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
  totalSteps: number;
  dailyGoal: number;
  daysTracked: number;
  daysGoalMet: number;
  averageDailySteps: number;
  dailySteps: { date: string; steps: number }[];
}

interface DashboardResponse {
  announcement: { id: string; title: string; date: string; summary: string };
  participants: DashboardParticipant[];
  stepLeaderboard: DashboardParticipant[];
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function StepEventDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<StepEvent | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // ── Fetchers ────────────────────────────────────────────────────────────

  const fetchEvent = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/step-events", { token });
      if (!res.ok) {
        setError(res.status === 401 ? "Sign in required" : "Could not load");
        return;
      }
      const data = await res.json();
      const match = (data.events as StepEvent[]).find(
        (e) => e.announcementId === id
      );
      if (!match) {
        setError("You aren't registered for this step event.");
        return;
      }
      setEvent(match);
    } catch {
      setError("Network error");
    }
  }, [id, token]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/events/${id}/dashboard`);
      if (!res.ok) return;
      const data = (await res.json()) as DashboardResponse;
      setDashboard(data);
    } catch {
      /* swallow — dashboard is decorative, my-event POST is the source of truth */
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await Promise.all([fetchEvent(), fetchDashboard()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchEvent, fetchDashboard]);

  useEffect(() => {
    void isHealthKitAvailable().then(setHealthAvailable);
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────

  const me = useMemo(
    () =>
      dashboard?.participants.find(
        (p) => p.name === user?.name && p.block === user?.block
      ) ?? null,
    [dashboard, user]
  );

  const days = useMemo(() => {
    if (!event) return [];
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const arr: { date: string; iso: string; isPast: boolean; isToday: boolean }[] = [];
    const today = todayIso();
    for (
      let d = new Date(start);
      d.getTime() < end.getTime();
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const iso = d.toISOString().slice(0, 10);
      arr.push({
        date: d.toISOString(),
        iso,
        isPast: iso < today,
        isToday: iso === today,
      });
    }
    return arr;
  }, [event]);

  const myDailyMap = useMemo(() => {
    const m = new Map<string, number>();
    if (me) {
      for (const d of me.dailySteps) {
        m.set(new Date(d.date).toISOString().slice(0, 10), d.steps);
      }
    }
    return m;
  }, [me]);

  const todaySteps = myDailyMap.get(todayIso()) ?? 0;
  const goal = event?.dailyGoal ?? 0;
  const goalProgress = goal > 0 ? Math.min(100, Math.round((todaySteps / goal) * 100)) : 0;
  const daysElapsed = days.filter((d) => d.isPast || d.isToday).length;
  const daysGoalMet = me?.daysGoalMet ?? 0;
  const totalSteps = me?.totalSteps ?? 0;

  const pctColor =
    goalProgress >= 100 ? "var(--success)" : goalProgress >= 60 ? "var(--warning)" : "var(--danger)";

  // ── Actions ─────────────────────────────────────────────────────────────

  async function doSync(force: boolean) {
    if (!event) return;
    setSyncing(true);
    setSyncMsg(null);
    // Floor to LOCAL midnight: the event start arrives as UTC midnight, but
    // HealthKit buckets by local calendar day, so starting the read at the
    // local day boundary captures the full first day's steps (otherwise an
    // early-morning sync reads a tiny window and returns nothing).
    const floor = new Date(
      Math.max(
        new Date(event.startDate).getTime(),
        new Date(event.rsvpCreatedAt).getTime()
      )
    );
    floor.setHours(0, 0, 0, 0);
    const startISO = floor.toISOString();
    const endISO = new Date().toISOString();
    const out: SyncOutcome = await syncStepsFromHealth(
      { eventId: event.announcementId, startISO, endISO, token },
      { force }
    );
    if (out.ok) {
      setSyncMsg(
        out.saved > 0
          ? `Synced ${out.saved} day${out.saved !== 1 ? "s" : ""} from Apple Health.`
          : "Up to date."
      );
      await fetchDashboard();
    } else {
      setSyncMsg(messageFor(out.reason));
    }
    setSyncing(false);
  }

  async function saveManualSteps(dateIso: string, steps: number) {
    if (!event) return false;
    if (!Number.isFinite(steps) || steps < 0) return false;
    try {
      const res = await apiFetch(`/api/events/${event.announcementId}/my-steps`, {
        method: "POST",
        token,
        body: JSON.stringify({
          entries: [{ date: dateIso, steps }],
        }),
      });
      if (!res.ok) return false;
      await fetchDashboard();
      return true;
    } catch {
      return false;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="one-surface flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <header className="flex items-center gap-3 py-4">
          <button type="button" onClick={() => navigate("/")} className="flex active:opacity-70">
            <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
          </button>
          <h1 className="text-[18px] font-bold">Stepup</h1>
        </header>
        <p className="rounded-[12px] px-4 py-3 text-[12px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3 py-3">
        <button type="button" onClick={() => navigate("/")} className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[20px] leading-none">{event.emoji ?? "🏃"}</span>
            <span className="truncate text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{event.title}</span>
          </div>
          <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--text-3)" }}>
            {fmtDate(event.startDate)} – {fmtDate(event.endDate)} · day {daysElapsed}/{days.length}
          </p>
        </div>
        <Link
          to={`/steps/${id}/leaderboard`}
          aria-label="Leaderboard"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full active:opacity-70"
          style={{ background: "rgba(231,181,61,0.18)" }}
        >
          <Icon name="emoji_events" size={23} fill style={{ color: "var(--gold)" }} />
        </Link>
      </header>

      {/* Today + goal ring */}
      <div className="rounded-[18px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="one-mono text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>TODAY</p>
            <p className="mt-1.5 text-[46px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: "var(--text)" }}>
              {todaySteps.toLocaleString("en-IN")}
            </p>
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--text-2)" }}>
              Goal {goal.toLocaleString("en-IN")} · <span className="font-bold" style={{ color: pctColor }}>{goalProgress}%</span>
            </p>
          </div>
          <GoalRing pct={goalProgress} color={pctColor} />
        </div>
        <div className="mt-4 flex gap-2.5">
          <MiniTile ms="monitoring" value={totalSteps} label="TOTAL" color="var(--text)" iconColor="var(--text-2)" />
          <MiniTile ms="check" value={daysGoalMet} label="MET" color="var(--success)" iconColor="var(--success)" />
          <MiniTile ms="close" value={daysElapsed - daysGoalMet} label="MISSED" color="var(--danger)" iconColor="var(--danger)" />
        </div>
      </div>

      <MyChallengeMobile eventId={event.announcementId} token={token} />

      {/* Sync action */}
      <div className="mt-3.5">
        {healthAvailable ? (
          <button
            type="button"
            onClick={() => doSync(true)}
            disabled={syncing}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] py-4 text-[17px] font-bold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {syncing ? <Loader2 size={18} className="animate-spin" /> : <Icon name="favorite" size={21} fill />}
            Sync from Apple Health
          </button>
        ) : (
          <div className="flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[12px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}>
            <Icon name="favorite" size={16} style={{ color: "var(--text-3)" }} />
            <p>Apple Health isn't available on this device. Tap any day below to enter steps manually.</p>
          </div>
        )}
        {syncMsg && (
          <p
            className="mt-2 rounded-[10px] px-3.5 py-2 text-[12px]"
            style={
              syncMsg.startsWith("Synced") || syncMsg === "Up to date."
                ? { background: "var(--success-soft)", color: "var(--success)" }
                : { background: "var(--warning-soft)", color: "var(--warning)" }
            }
          >
            {syncMsg}
          </p>
        )}
      </div>

      {/* Daily progress */}
      <div className="mb-3 mt-5 flex items-center gap-2" style={{ color: "var(--text-3)" }}>
        <Icon name="calendar_month" size={16} style={{ color: "var(--text-3)" }} />
        <span className="one-mono text-[11px] font-semibold" style={{ letterSpacing: "0.14em" }}>DAILY PROGRESS</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {days.map((d) => {
          const steps = myDailyMap.get(d.iso) ?? 0;
          const met = goal > 0 && steps >= goal;
          const isEditing = editingDate === d.iso;
          const barColor = met ? "var(--success)" : steps > 0 ? "var(--warning)" : "var(--surface-3)";
          return (
            <div
              key={d.iso}
              className="flex items-center gap-3 rounded-[14px] px-3.5 py-3"
              style={
                d.isToday
                  ? { background: "var(--accent-soft)", border: "1.5px solid var(--accent)" }
                  : { background: "var(--surface)", border: "1px solid var(--border)" }
              }
            >
              <div className="w-[84px] flex-shrink-0">
                <p className="text-[15px] font-bold" style={{ color: "var(--text)" }}>{fmtShortDate(d.date)}</p>
                <p className="one-mono mt-0.5 text-[9.5px] font-semibold" style={{ color: d.isToday ? "var(--accent)" : "var(--text-3)", letterSpacing: "0.1em" }}>
                  {d.isToday ? "TODAY" : d.isPast ? "" : "UPCOMING"}
                </p>
              </div>
              {isEditing ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    placeholder="steps"
                    className="flex-1 rounded-[10px] px-2.5 py-1.5 text-[14px] outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const n = parseInt(editValue, 10);
                      if (await saveManualSteps(d.iso, Number.isFinite(n) ? n : 0)) {
                        setEditingDate(null);
                        setEditValue("");
                      }
                    }}
                    className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-bold text-white"
                    style={{ background: "var(--success)" }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingDate(null); setEditValue(""); }}
                    className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
                    style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    {d.isPast || d.isToday ? (
                      <>
                        <p className="text-[16px] font-bold tabular-nums" style={{ color: steps === 0 ? "var(--text-3)" : met ? "var(--success)" : "var(--text)" }}>
                          {steps > 0 ? steps.toLocaleString("en-IN") : "—"}
                        </p>
                        {goal > 0 && (
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (steps / goal) * 100)}%`, background: barColor }} />
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[18px]" style={{ color: "var(--text-3)" }}>—</span>
                    )}
                  </div>
                  {(d.isPast || d.isToday) && (
                    <button
                      type="button"
                      onClick={() => { setEditingDate(d.iso); setEditValue(String(steps || "")); }}
                      aria-label="Edit"
                      className="flex flex-shrink-0 active:opacity-70"
                    >
                      <Icon name="edit" size={18} style={{ color: "var(--text-3)" }} />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Helper foot */}
      <div className="mt-4 flex items-start gap-2 text-[12.5px]" style={{ color: "var(--text-3)" }}>
        <Icon name="sync" size={16} style={{ color: "var(--text-3)" }} />
        <p className="leading-relaxed">
          Sync runs automatically when you open the app (max once every 15 min). Tap Sync above to force a refresh. Manual entries override Health values for that day.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MiniTile({ ms, value, label, color, iconColor }: { ms: string; value: number; label: string; color: string; iconColor: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-[12px] py-2.5" style={{ border: "1px solid var(--border)" }}>
      <Icon name={ms} size={19} style={{ color: iconColor }} />
      <span className="text-[17px] font-extrabold tabular-nums" style={{ color }}>{value.toLocaleString("en-IN")}</span>
      <span className="one-mono text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

function GoalRing({ pct, color }: { pct: number; color: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" className="flex-shrink-0">
      <circle cx="39" cy="39" r={r} stroke="var(--surface-3)" strokeWidth="7" fill="none" />
      <circle
        cx="39" cy="39" r={r}
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 39 39)"
      />
      <text x="39" y="44" textAnchor="middle" fill="var(--text)" style={{ fontSize: "15px", fontWeight: 700 }}>
        {pct}%
      </text>
    </svg>
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
}

function messageFor(reason: string): string {
  if (reason === "denied")
    return "Apple Health access denied. Enable it in Settings → Privacy → Health → OneRMV.";
  if (reason === "throttled") return "Just synced — try again in 15 min.";
  if (reason === "none") return "No new step data from Apple Health.";
  if (reason === "web")
    return "Sync only works on the iPhone app, not the web.";
  return "Could not sync. Tap to retry.";
}
