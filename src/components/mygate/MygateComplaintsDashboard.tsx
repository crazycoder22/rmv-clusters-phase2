"use client";

import { useCallback, useEffect, useState } from "react";

type Analytics = {
  total: number;
  openCount: number;
  closedCount: number;
  avgResolutionMinutes: number | null;
  byStatus: { label: string; count: number }[];
  byCategory: { label: string; count: number }[];
  byBlock: { label: string; count: number }[];
  byAssignee: { label: string; count: number }[];
  byCategoryResolution: { label: string; avgMinutes: number | null }[];
  byMonth: { month: string; count: number }[];
};

type Complaint = {
  id: string;
  mygateId: string;
  subject: string;
  category: string | null;
  subCategory: string | null;
  type: string | null;
  block: number | null;
  flatNumber: string | null;
  flatRaw: string | null;
  createdBy: string | null;
  status: string;
  isOpen: boolean;
  assignee: string | null;
  comments: string | null;
  mygateCreatedAt: string | null;
  closedAt: string | null;
  resolutionMinutes: number | null;
  reopenCount: number;
  rating: number | null;
};

function fmtMins(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "2-digit" }).format(new Date(iso));
}

const STATUS_STYLE: Record<string, string> = {
  Resolved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  Closed: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "On Hold": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function Bars({ title, data, accent = "bg-primary-500" }: { title: string; data: { label: string; count: number }[]; accent?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={String(d.label)} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs text-gray-600 dark:text-gray-400" title={String(d.label)}>{d.label}</span>
            <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
              <div className={`h-full ${accent} rounded`} style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MygateComplaintsDashboard() {
  const [a, setA] = useState<Analytics | null>(null);
  const [items, setItems] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/mygate-complaints/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setA(d))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (category) p.set("category", category);
    if (open) p.set("open", open);
    if (q.trim()) p.set("q", q.trim());
    p.set("page", String(page));
    try {
      const r = await fetch(`/api/admin/mygate-complaints?${p}`);
      if (r.ok) {
        const d = await r.json();
        setItems(d.items);
        setTotal(d.total);
        setTotalPages(d.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [status, category, open, q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => setPage(1), [status, category, open, q]);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      {a && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: a.total, cls: "text-gray-900 dark:text-gray-100" },
            { label: "Open", value: a.openCount, cls: "text-blue-600 dark:text-blue-400" },
            { label: "Closed", value: a.closedCount, cls: "text-green-600 dark:text-green-400" },
            { label: "Avg resolution", value: fmtMins(a.avgResolutionMinutes), cls: "text-amber-600 dark:text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
              <div className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {a && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Bars title="By status" data={a.byStatus} accent="bg-blue-500" />
          <Bars title="By category" data={a.byCategory} accent="bg-indigo-500" />
          <Bars title="By block" data={a.byBlock} accent="bg-emerald-500" />
          <Bars title="Complaints per month" data={a.byMonth.map((m) => ({ label: m.month, count: m.count }))} accent="bg-purple-500" />
          <Bars title="Top assignees" data={a.byAssignee} accent="bg-rose-500" />
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Avg resolution by category</h3>
            <div className="space-y-2">
              {a.byCategoryResolution.map((r) => (
                <div key={r.label} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{r.label}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{fmtMins(r.avgMinutes)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject, resident, flat, assignee…"
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <select value={open} onChange={(e) => setOpen(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          <option value="">All</option>
          <option value="true">Open</option>
          <option value="false">Closed</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          <option value="">Any status</option>
          {a?.byStatus.map((s) => <option key={s.label} value={String(s.label)}>{s.label}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          <option value="">Any category</option>
          {a?.byCategory.map((c) => <option key={c.label} value={String(c.label)}>{c.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          {loading ? "Loading…" : `${total} complaint(s)`}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 flex items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.subject}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    #{c.mygateId} · {c.flatRaw ?? "—"} · {c.category ?? "—"}
                    {c.createdBy ? ` · ${c.createdBy}` : ""} · {fmtDate(c.mygateCreatedAt)}
                  </p>
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                  {c.status}
                </span>
              </button>
              {expanded === c.id && (
                <div className="px-4 pb-3 -mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <span>Assignee: <b className="text-gray-800 dark:text-gray-200">{c.assignee ?? "—"}</b></span>
                    <span>Resolution: <b className="text-gray-800 dark:text-gray-200">{fmtMins(c.resolutionMinutes)}</b></span>
                    <span>Closed: <b className="text-gray-800 dark:text-gray-200">{fmtDate(c.closedAt)}</b></span>
                    <span>Reopened: <b className="text-gray-800 dark:text-gray-200">{c.reopenCount}</b></span>
                  </div>
                  {c.comments && <p className="pt-1"><span className="text-gray-500">Comments:</span> {c.comments}</p>}
                </div>
              )}
            </div>
          ))}
          {!loading && items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No complaints match.</div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 text-gray-700 dark:text-gray-300">Prev</button>
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 text-gray-700 dark:text-gray-300">Next</button>
        </div>
      )}
    </div>
  );
}
