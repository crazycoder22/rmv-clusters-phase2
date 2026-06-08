"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRole } from "@/hooks/useRole";

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

export default function OccupancyDashboard() {
  const { isAdmin, isLoading } = useRole();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    fetch("/api/admin/occupancy")
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

  const t = data?.totals;
  const ownerPct = t && t.total ? Math.round((t.ownerOccupied / t.total) * 100) : 0;
  const tenantPct = t && t.total ? 100 - ownerPct : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Flat Occupancy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Owner vs tenant occupancy across all flats. Bank-owned, tenant-registered,
          and vacant flats all count as tenant-occupied.
        </p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {t && (
        <>
          {/* Headline cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card label="Total flats" value={t.total} tone="slate" />
            <Card label="Owner-occupied" value={t.ownerOccupied} sub={`${ownerPct}%`} tone="emerald" />
            <Card label="Tenant-occupied" value={t.tenantOccupied} sub={`${tenantPct}%`} tone="amber" />
            <Card label="Bank-owned" value={t.bank} tone="indigo" />
          </div>

          {/* Owner vs tenant bar */}
          <div className="mb-6 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
              <span>Owner-occupied {ownerPct}%</span>
              <span>Tenant-occupied {tenantPct}%</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="bg-emerald-500" style={{ width: `${ownerPct}%` }} />
              <div className="bg-amber-500" style={{ width: `${tenantPct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <Mini label="Tenant registered" value={t.tenantRegistered} />
              <Mini label="Bank-owned" value={t.bank} />
              <Mini label="Vacant" value={t.vacant} />
            </div>
          </div>

          {/* Per-block table */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Block</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">Owner</th>
                  <th className="px-3 py-2 text-right font-medium text-amber-600 dark:text-amber-400">Tenant</th>
                  <th className="px-3 py-2 text-right font-medium">Bank</th>
                  <th className="px-3 py-2 text-right font-medium">Vacant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data!.byBlock.map((b) => (
                  <tr key={b.block} className="text-gray-800 dark:text-gray-200">
                    <td className="px-4 py-2 font-medium">Block {b.block}</td>
                    <td className="px-3 py-2 text-right">{b.total}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{b.ownerOccupied}</td>
                    <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{b.tenantOccupied}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{b.bank}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{b.vacant}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700/50 font-semibold text-gray-900 dark:text-gray-100">
                <tr>
                  <td className="px-4 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{t.total}</td>
                  <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{t.ownerOccupied}</td>
                  <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{t.tenantOccupied}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{t.bank}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{t.vacant}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone: string }) {
  const tones: Record<string, string> = {
    slate: "border-gray-200 dark:border-gray-700",
    emerald: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10",
    amber: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10",
    indigo: "border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10",
  };
  return (
    <div className={`rounded-xl border ${tones[tone]} bg-white dark:bg-gray-800 p-4`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
        {sub && <span className="ml-1 text-sm font-medium text-gray-400">{sub}</span>}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 py-2">
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}
