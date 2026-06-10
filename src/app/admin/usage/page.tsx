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

const PLAT: Record<string, { label: string; emoji: string; cls: string }> = {
  web: { label: "Website", emoji: "🌐", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ios: { label: "iOS app", emoji: "", cls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200" },
  android: { label: "Android app", emoji: "🤖", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  app: { label: "App", emoji: "📱", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
};

export default function UsageDashboard() {
  const { isAdmin, isLoading } = useRole();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    fetch("/api/admin/usage")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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
    </div>
  );
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
