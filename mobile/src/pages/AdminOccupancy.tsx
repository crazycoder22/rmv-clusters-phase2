import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Block = {
  block: number;
  total: number;
  ownerOccupied: number;
  bank: number;
  tenantRegistered: number;
  vacant: number;
  tenantOccupied: number;
};
type Data = {
  totals: {
    total: number;
    ownerOccupied: number;
    bank: number;
    tenantRegistered: number;
    vacant: number;
    tenantOccupied: number;
  };
  byBlock: Block[];
};

export default function AdminOccupancy() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/occupancy", { token })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Admins only"))))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const t = data?.totals;
  const ownerPct = t && t.total ? Math.round((t.ownerOccupied / t.total) * 100) : 0;
  const tenantPct = t && t.total ? 100 - ownerPct : 0;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold text-white">Flat Occupancy</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" size={22} /></div>
      ) : error ? (
        <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">{error}</p>
      ) : t ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Card label="Total flats" value={t.total} tone="slate" />
            <Card label="Bank-owned" value={t.bank} tone="indigo" />
            <Card label="Owner-occupied" value={t.ownerOccupied} sub={`${ownerPct}%`} tone="emerald" />
            <Card label="Tenant-occupied" value={t.tenantOccupied} sub={`${tenantPct}%`} tone="amber" />
          </div>

          {/* Bar */}
          <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
            <div className="mb-1 flex justify-between text-[11px] text-slate-400">
              <span>Owner {ownerPct}%</span>
              <span>Tenant {tenantPct}%</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-700">
              <div className="bg-emerald-500" style={{ width: `${ownerPct}%` }} />
              <div className="bg-amber-500" style={{ width: `${tenantPct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Mini label="Tenant reg." value={t.tenantRegistered} />
              <Mini label="Bank" value={t.bank} />
              <Mini label="Vacant" value={t.vacant} />
            </div>
          </div>

          {/* Per-block */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Block</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                  <th className="px-2 py-2 text-right font-medium text-emerald-400">Own</th>
                  <th className="px-2 py-2 text-right font-medium text-amber-400">Ten</th>
                  <th className="px-2 py-2 text-right font-medium">Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-800/40">
                {data!.byBlock.map((b) => (
                  <tr key={b.block} className="text-slate-200">
                    <td className="px-3 py-2 font-medium">Block {b.block}</td>
                    <td className="px-2 py-2 text-right">{b.total}</td>
                    <td className="px-2 py-2 text-right font-semibold text-emerald-400">{b.ownerOccupied}</td>
                    <td className="px-2 py-2 text-right text-amber-400">{b.tenantOccupied}</td>
                    <td className="px-2 py-2 text-right text-slate-400">{b.bank}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-800 font-semibold text-white">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-2 py-2 text-right">{t.total}</td>
                  <td className="px-2 py-2 text-right text-emerald-400">{t.ownerOccupied}</td>
                  <td className="px-2 py-2 text-right text-amber-400">{t.tenantOccupied}</td>
                  <td className="px-2 py-2 text-right text-slate-400">{t.bank}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone: string }) {
  const tones: Record<string, string> = {
    slate: "border-slate-700",
    emerald: "border-emerald-500/40 bg-emerald-500/10",
    amber: "border-amber-500/40 bg-amber-500/10",
    indigo: "border-indigo-500/40 bg-indigo-500/10",
  };
  return (
    <div className={`rounded-2xl border ${tones[tone]} bg-slate-800/60 p-3`}>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-white">
        {value}
        {sub && <span className="ml-1 text-sm font-medium text-slate-400">{sub}</span>}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-900/50 py-2">
      <p className="text-base font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
