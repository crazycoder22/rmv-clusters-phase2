"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/hooks/useRole";

type Recent = {
  name: string;
  block: number;
  flatNumber: string;
  platform: string;
  lastSeenAt: string;
};
type Data = {
  totalApproved: number;
  neverSeen: number;
  everSeen: number;
  active: { d1: number; d7: number; d30: number };
  byPlatform: Record<string, number>;
  recent: Recent[];
};

type PlatformSplit = { web: number; ios: number; android: number; app: number };
type FeatureRow = {
  feature: string;
  pageKey: string;
  totalOpens: number;
  uniqueResidents: number;
  avgDwellMs: number | null;
  platform: PlatformSplit;
};
type InitiativeRow = {
  id: string;
  title: string;
  totalOpens: number;
  uniqueResidents: number;
  avgDwellMs: number | null;
  platform: PlatformSplit;
};
type PageData = {
  features: FeatureRow[];
  initiatives: InitiativeRow[];
  trend: { date: string; count: number }[];
  hourly: { hour: number; count: number }[];
  hourlyDays: number;
};

const PLAT: Record<string, { label: string; emoji: string; cls: string }> = {
  web: { label: "Website", emoji: "🌐", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ios: { label: "iOS app", emoji: "", cls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200" },
  android: { label: "Android app", emoji: "🤖", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  app: { label: "App", emoji: "📱", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
};

export default function UsageDashboard() {
  const { isAdmin, isLoading } = useRole();
  const [data, setData] = useState<Data | null>(null);
  const [pages, setPages] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    fetch("/api/admin/usage")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    fetch("/api/admin/usage/pages")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then(setPages)
      .catch(() => {});
  }, [isLoading, isAdmin]);

  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-gray-500">Admins only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">App &amp; Website Usage</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Who&apos;s actually using each platform, based on recent activity.
      </p>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {data && (
        <>
          {/* Active overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Active today" value={data.active.d1} />
            <StatCard label="Active this week" value={data.active.d7} />
            <StatCard label="Active this month" value={data.active.d30} />
            <StatCard label="Never signed in" value={data.neverSeen} muted />
          </div>

          {/* Platform split (active last 30 days) */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Platform split <span className="text-sm font-normal text-gray-500">· active last 30 days</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
            {(["web", "ios", "android"] as const).map((p) => (
              <div key={p} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{PLAT[p].emoji || "📱"}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{PLAT[p].label}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">
                  {data.byPlatform[p] ?? 0}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
            {data.everSeen} of {data.totalApproved} residents have signed in at least once.
            Each person is counted by their most recent platform. The iOS/Android counts
            grow as the apps roll out beyond TestFlight / Play.
          </p>

          {/* Recent activity table */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Most recently active</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Resident</th>
                  <th className="text-left font-medium px-3 py-2">Flat</th>
                  <th className="text-left font-medium px-3 py-2">Platform</th>
                  <th className="text-left font-medium px-3 py-2">Last active</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => {
                  const cfg = PLAT[r.platform] ?? PLAT.app;
                  return (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-700/60">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.name}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">B{r.block}-{r.flatNumber}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${cfg.cls}`}>
                          {cfg.emoji} {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{fmt(r.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pages && <PageViews data={pages} />}
    </div>
  );
}

function PageViews({ data }: { data: PageData }) {
  const hasData = data.features.length > 0 || data.initiatives.length > 0;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Page views</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        How many residents open each page, and from which platform. Counts only — no individual viewing history.
      </p>

      {!hasData ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No views recorded yet. Counts appear once residents open a tracked page.
        </p>
      ) : (
        <>
          {/* Per-feature/page */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Page</th>
                  <th className="text-right font-medium px-3 py-2">People</th>
                  <th className="text-right font-medium px-3 py-2">Opens</th>
                  <th className="text-right font-medium px-3 py-2">Avg time</th>
                  <th className="text-left font-medium px-3 py-2">Platforms</th>
                </tr>
              </thead>
              <tbody>
                {data.features.map((f) => (
                  <tr key={`${f.feature}|${f.pageKey}`} className="border-t border-gray-100 dark:border-gray-700/60">
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{prettyPage(f.feature, f.pageKey)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{f.uniqueResidents}</td>
                    <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">{f.totalOpens}</td>
                    <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">{fmtDur(f.avgDwellMs)}</td>
                    <td className="px-3 py-2"><PlatformCell split={f.platform} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-initiative */}
          {data.initiatives.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">By initiative</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Initiative</th>
                      <th className="text-right font-medium px-3 py-2">People</th>
                      <th className="text-right font-medium px-3 py-2">Opens</th>
                      <th className="text-right font-medium px-3 py-2">Avg time</th>
                      <th className="text-left font-medium px-3 py-2">Platforms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.initiatives.map((i) => (
                      <tr key={i.id} className="border-t border-gray-100 dark:border-gray-700/60">
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">{i.title}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{i.uniqueResidents}</td>
                        <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">{i.totalOpens}</td>
                        <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">{fmtDur(i.avgDwellMs)}</td>
                        <td className="px-3 py-2"><PlatformCell split={i.platform} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Usage by time of day */}
          {data.hourly?.some((h) => h.count > 0) && (
            <HourlyStrip hourly={data.hourly} days={data.hourlyDays} />
          )}

          {/* Daily trend */}
          {data.trend.length > 0 && <TrendStrip trend={data.trend} />}
        </>
      )}
    </section>
  );
}

function fmtHour(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}

function HourlyStrip({ hourly, days }: { hourly: { hour: number; count: number }[]; days: number }) {
  const max = Math.max(...hourly.map((h) => h.count), 1);
  const total = hourly.reduce((s, h) => s + h.count, 0);
  const peak = hourly.reduce((a, b) => (b.count > a.count ? b : a), hourly[0]);
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Usage by time of day{" "}
        <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
          · last 7 days{days > 0 ? ` · ${days} day${days === 1 ? "" : "s"} of data` : ""} · {total} opens
          {peak.count > 0 ? ` · busiest ${fmtHour(peak.hour)}–${fmtHour((peak.hour + 1) % 24)}` : ""}
        </span>
      </h3>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
        <div className="flex items-end gap-0.5 h-28">
          {hourly.map((h) => (
            <div
              key={h.hour}
              className="flex-1 flex items-end h-full"
              title={`${fmtHour(h.hour)}–${fmtHour((h.hour + 1) % 24)}: ${h.count} open${h.count === 1 ? "" : "s"}`}
            >
              <div
                className={`w-full rounded-sm min-h-[2px] ${h.hour === peak.hour && peak.count > 0 ? "bg-blue-600 dark:bg-blue-400" : "bg-blue-500/60 dark:bg-blue-400/50"}`}
                style={{ height: `${(h.count / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        {/* x-axis ticks every 6 hours */}
        <div className="flex mt-1.5">
          {hourly.map((h) => (
            <div key={h.hour} className="flex-1 text-center">
              {h.hour % 6 === 0 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{fmtHour(h.hour)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
        Each bar is one hour (IST), counting page opens across the last 7 days. The shape shows when residents are most active.
      </p>
    </div>
  );
}

function PlatformCell({ split }: { split: PlatformSplit }) {
  const items = (["web", "ios", "android", "app"] as const)
    .map((p) => ({ p, n: split[p] }))
    .filter((x) => x.n > 0);
  if (items.length === 0) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ p, n }) => (
        <span key={p} className={`text-xs font-medium rounded-full px-2 py-0.5 ${PLAT[p].cls}`}>
          {PLAT[p].emoji || "📱"} {n}
        </span>
      ))}
    </div>
  );
}

function TrendStrip({ trend }: { trend: { date: string; count: number }[] }) {
  const max = Math.max(...trend.map((t) => t.count), 1);
  const total = trend.reduce((s, t) => s + t.count, 0);
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Opens per day <span className="text-xs font-normal text-gray-400 dark:text-gray-500">· last 30 days · {total} total</span>
      </h3>
      <div className="flex items-end gap-0.5 h-24 rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
        {trend.map((t) => (
          <div key={t.date} className="flex-1 group relative flex items-end" title={`${t.date}: ${t.count}`}>
            <div
              className="w-full rounded-sm bg-blue-500/70 dark:bg-blue-400/60 min-h-[2px]"
              style={{ height: `${(t.count / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtDur(ms: number | null): string {
  if (ms == null || ms < 1000) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function prettyPage(feature: string, pageKey: string): string {
  const f = feature.charAt(0).toUpperCase() + feature.slice(1);
  const k = pageKey === "list" ? "List" : pageKey === "detail" ? "Detail" : pageKey;
  return `${f} · ${k}`;
}

function StatCard({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${muted ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
      <p className={`text-3xl font-bold tabular-nums ${muted ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>{value}</p>
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
