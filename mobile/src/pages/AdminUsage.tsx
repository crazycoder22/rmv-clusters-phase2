import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

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

const PLAT: Record<string, { label: string; short: string }> = {
  web: { label: "🌐 Website", short: "Web" },
  ios: { label: " iOS", short: "iOS" },
  android: { label: "🤖 Android", short: "Android" },
  app: { label: "📱 App", short: "App" },
};

export default function AdminUsage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/usage", { token })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Admins only"))))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold text-white">App &amp; Website Usage</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" size={22} /></div>
      ) : error ? (
        <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">{error}</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Card label="Today" value={data.active.d1} tone="emerald" />
            <Card label="This week" value={data.active.d7} tone="indigo" />
            <Card label="This month" value={data.active.d30} tone="slate" />
          </div>

          {/* Platform split */}
          <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Platform · active last 30 days
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Card label="🌐 Website" value={data.byPlatform.web ?? 0} tone="slate" />
            <Card label=" iOS" value={data.byPlatform.ios ?? 0} tone="slate" />
            <Card label="🤖 Android" value={data.byPlatform.android ?? 0} tone="slate" />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {data.everSeen} of {data.totalApproved} residents have signed in at least once
            · {data.neverSeen} never. Counted by most-recent platform.
          </p>

          {/* Recent activity */}
          <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Most recently active</p>
          <div className="overflow-hidden rounded-2xl border border-slate-700">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Resident</th>
                  <th className="px-2 py-2 text-left font-medium">Platform</th>
                  <th className="px-2 py-2 text-right font-medium">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-800/40">
                {data.recent.map((r, i) => (
                  <tr key={i} className="text-slate-200">
                    <td className="px-3 py-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-[10px] text-slate-500">B{r.block}-{r.flatNumber}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-300">{(PLAT[r.platform] ?? PLAT.app).short}</td>
                    <td className="px-2 py-2 text-right text-slate-400">{fmt(r.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    slate: "border-slate-700",
    emerald: "border-emerald-500/40 bg-emerald-500/10",
    indigo: "border-indigo-500/40 bg-indigo-500/10",
  };
  return (
    <div className={`rounded-2xl border ${tones[tone]} bg-slate-800/60 p-3`}>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function fmt(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}
