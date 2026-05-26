import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { isAdmin } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

interface Stats {
  dateFrom: string;
  dateTo: string;
  rangeCount: number;
  rangeResidentApproved: number;
  byBlock: { block: number; total: number; residentApproved: number }[];
  topSources: { source: string | null; count: number }[];
  topGuards: { guard: string | null; count: number }[];
}

interface TrendPoint {
  date: string;
  total: number;
  approved: number;
  pct: number;
}

interface FlatRow {
  block: number;
  flatNumber: string;
  total: number;
  approved: number;
  pct: number;
}

type Window = "today" | "7d" | "30d";

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminVisits() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Role gate — admins only (mirrors the server check).
  useEffect(() => {
    if (user && !isAdmin(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [windowSel, setWindow] = useState<Window>("7d");
  const [blockSel, setBlockSel] = useState<"" | "1" | "2" | "3" | "4">("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [flats, setFlats] = useState<FlatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // IST date helpers — match the server's istTodayYmd().
  const dateRange = useMemo(() => {
    const today = istTodayYmd();
    if (windowSel === "today") return { from: today, to: today };
    const days = windowSel === "7d" ? 6 : 29;
    const d = new Date(`${today}T00:00:00+05:30`);
    d.setDate(d.getDate() - days);
    const from = d.toISOString().slice(0, 10);
    return { from, to: today };
  }, [windowSel]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const blockQs = blockSel ? `&block=${blockSel}` : "";
      const [statsRes, trendRes, flatsRes] = await Promise.all([
        apiFetch(
          `/api/visit-log/stats?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`,
          { token }
        ),
        apiFetch(
          `/api/visit-log/trend?days=${windowSel === "today" ? 7 : windowSel === "7d" ? 14 : 30}`,
          { token }
        ),
        apiFetch(
          `/api/visit-log/by-flat?dateFrom=${dateRange.from}&dateTo=${dateRange.to}&minTotal=3${blockQs}`,
          { token }
        ),
      ]);

      if (!statsRes.ok || !trendRes.ok || !flatsRes.ok) {
        setError(
          statsRes.status === 403 ? "Not authorised" : "Could not load stats"
        );
        return;
      }
      const [s, t, f] = await Promise.all([
        statsRes.json(),
        trendRes.json(),
        flatsRes.json(),
      ]);
      setStats(s);
      setTrend(t.trend ?? []);
      setFlats(f.flats ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [dateRange, blockSel, token, windowSel]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const overallPct =
    stats && stats.rangeCount > 0
      ? Math.round((stats.rangeResidentApproved / stats.rangeCount) * 100)
      : 0;
  const denied = stats ? stats.rangeCount - stats.rangeResidentApproved : 0;

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
          <h1 className="text-lg font-semibold text-white">Visitor approvals</h1>
          <p className="truncate text-[11px] text-slate-500">
            {labelFor(windowSel)} · {fmtRange(dateRange.from, dateRange.to)}
          </p>
        </div>
      </header>

      {/* Window selector */}
      <section className="mb-3 flex gap-1.5">
        {(["today", "7d", "30d"] as Window[]).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              windowSel === w
                ? "bg-indigo-500 text-white"
                : "bg-slate-900 text-slate-300 active:bg-slate-800"
            )}
          >
            {labelFor(w)}
          </button>
        ))}
      </section>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
          {error}
        </p>
      ) : !stats ? null : (
        <>
          {/* Overall summary */}
          <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Resident-approved
                </p>
                <p className="mt-0.5 text-3xl font-bold tabular-nums text-white">
                  {overallPct}%
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {stats.rangeResidentApproved.toLocaleString()} of{" "}
                  {stats.rangeCount.toLocaleString()} visits
                </p>
              </div>
              <PctRing pct={overallPct} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Mini
                value={stats.rangeResidentApproved}
                label="approved"
                icon={CheckCircle2}
                tint="bg-emerald-500/15 text-emerald-200"
              />
              <Mini
                value={denied}
                label="not approved"
                icon={XCircle}
                tint="bg-red-500/15 text-red-200"
              />
            </div>
          </section>

          {/* Per-block */}
          <section className="mb-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Per block
            </h2>
            <div className="space-y-2">
              {stats.byBlock.map((b) => {
                const pct =
                  b.total > 0
                    ? Math.round((b.residentApproved / b.total) * 100)
                    : 0;
                const isSel = blockSel === String(b.block);
                return (
                  <button
                    key={b.block}
                    type="button"
                    onClick={() =>
                      setBlockSel(
                        isSel ? "" : (String(b.block) as "1" | "2" | "3" | "4")
                      )
                    }
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-2xl border p-3 text-left",
                      isSel
                        ? "border-indigo-400 bg-indigo-500/15"
                        : "border-slate-700 bg-slate-800/60 active:bg-slate-800"
                    )}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-slate-200">
                      B{b.block}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-white">
                          Block {b.block}
                        </p>
                        <p
                          className={clsx(
                            "text-sm font-bold tabular-nums",
                            pct >= 80
                              ? "text-emerald-300"
                              : pct >= 60
                                ? "text-amber-300"
                                : "text-red-300"
                          )}
                        >
                          {pct}%
                        </p>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
                        <div
                          className={clsx(
                            "h-full rounded-full transition-all",
                            pct >= 80
                              ? "bg-emerald-500"
                              : pct >= 60
                                ? "bg-amber-500"
                                : "bg-red-500"
                          )}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {b.residentApproved}/{b.total} visits
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {blockSel && (
              <p className="mt-1.5 text-[10px] text-slate-500">
                Tap again to clear block filter.
              </p>
            )}
          </section>

          {/* Daily trend (compact spark bars) */}
          {trend.length > 0 && (
            <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Daily trend
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <TrendingUp size={10} /> last {trend.length}d
                </span>
              </div>
              <TrendBars trend={trend} />
            </section>
          )}

          {/* Worst flats list */}
          <section className="pb-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lowest-approval flats
              {blockSel && (
                <span className="ml-1.5 normal-case text-slate-400">
                  in Block {blockSel}
                </span>
              )}
            </h2>
            {flats.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-xs text-slate-500">
                No flats with ≥3 visits in this window.
              </p>
            ) : (
              <div className="space-y-1.5">
                {flats.slice(0, 25).map((f) => (
                  <FlatRowCard key={`${f.block}-${f.flatNumber}`} flat={f} />
                ))}
                {flats.length > 25 && (
                  <p className="pt-1 text-center text-[10px] text-slate-500">
                    Showing 25 of {flats.length}
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Mini({
  value,
  label,
  icon: Icon,
  tint,
}: {
  value: number;
  label: string;
  icon: typeof CheckCircle2;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/40 px-2.5 py-2">
      <div
        className={clsx(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
          tint
        )}
      >
        <Icon size={12} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight tabular-nums text-white">
          {value.toLocaleString()}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </p>
      </div>
    </div>
  );
}

function PctRing({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  const color =
    pct >= 80
      ? "stroke-emerald-400"
      : pct >= 60
        ? "stroke-amber-400"
        : "stroke-red-400";
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="flex-shrink-0">
      <circle
        cx="28"
        cy="28"
        r={r}
        className="stroke-slate-700"
        strokeWidth="6"
        fill="none"
      />
      <circle
        cx="28"
        cy="28"
        r={r}
        className={clsx(color, "transition-all")}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

function TrendBars({ trend }: { trend: TrendPoint[] }) {
  const maxTotal = Math.max(...trend.map((t) => t.total), 1);
  return (
    <div className="flex h-20 items-end gap-1">
      {trend.map((t) => {
        const h = Math.max(4, (t.total / maxTotal) * 100);
        const color =
          t.pct >= 80
            ? "bg-emerald-500"
            : t.pct >= 60
              ? "bg-amber-500"
              : "bg-red-500";
        return (
          <div
            key={t.date}
            className="group relative flex flex-1 flex-col items-center justify-end"
          >
            <div
              className={clsx("w-full rounded-t-sm", color)}
              style={{ height: `${h}%` }}
              title={`${t.date}: ${t.pct}% (${t.approved}/${t.total})`}
            />
          </div>
        );
      })}
    </div>
  );
}

function FlatRowCard({ flat }: { flat: FlatRow }) {
  const color =
    flat.pct >= 80
      ? "text-emerald-300"
      : flat.pct >= 60
        ? "text-amber-300"
        : "text-red-300";
  const bg =
    flat.pct >= 80
      ? "bg-emerald-500"
      : flat.pct >= 60
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <article className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
      <div className="flex h-8 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 font-mono text-[11px] text-slate-300">
        B{flat.block}·{flat.flatNumber}
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
          <div
            className={clsx("h-full rounded-full", bg)}
            style={{ width: `${Math.min(flat.pct, 100)}%` }}
          />
        </div>
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500">
          <Users size={9} />
          {flat.approved}/{flat.total} approved
        </p>
      </div>
      <p className={clsx("text-sm font-bold tabular-nums", color)}>
        {flat.pct}%
      </p>
    </article>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function labelFor(w: Window): string {
  if (w === "today") return "Today";
  if (w === "7d") return "Last 7 days";
  return "Last 30 days";
}

function istTodayYmd(): string {
  // Same convention as the server's istTodayYmd(): YYYY-MM-DD in Asia/Kolkata.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtRange(from: string, to: string): string {
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

function fmt(ymd: string): string {
  // ymd is already in IST; build a Date locally for formatting.
  return new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });
}
