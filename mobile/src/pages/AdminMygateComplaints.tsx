import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Analytics = {
  total: number;
  openCount: number;
  closedCount: number;
  avgResolutionMinutes: number | null;
  byStatus: { label: string; count: number }[];
  byCategory: { label: string; count: number }[];
  byBlock: { label: string | number; count: number }[];
  byMonth: { month: string; count: number }[];
};

type Complaint = {
  id: string;
  mygateId: string;
  subject: string;
  category: string | null;
  flatRaw: string | null;
  createdBy: string | null;
  status: string;
  assignee: string | null;
  comments: string | null;
  mygateCreatedAt: string | null;
  closedAt: string | null;
  resolutionMinutes: number | null;
  reopenCount: number;
};

function fmtMins(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "2-digit" }).format(new Date(iso));
}
const STATUS_CLS: Record<string, string> = {
  Resolved: "bg-emerald-500/15 text-emerald-300",
  Closed: "bg-slate-600/40 text-slate-300",
  "In Progress": "bg-blue-500/15 text-blue-300",
  "On Hold": "bg-amber-500/15 text-amber-300",
};

function Bars({ title, data, color }: { title: string; data: { label: string | number; count: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-300">{title}</p>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={String(d.label)} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px] text-slate-400">{d.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-700">
              <div className={`h-full rounded ${color}`} style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
            <span className="w-6 text-right text-[11px] text-slate-300">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMygateComplaints() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [a, setA] = useState<Analytics | null>(null);
  const [items, setItems] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/mygate-complaints/analytics", { token })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setA(d))
      .catch(() => {});
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const p = new URLSearchParams();
    if (open) p.set("open", open);
    if (category) p.set("category", category);
    if (q.trim()) p.set("q", q.trim());
    p.set("page", String(page));
    try {
      const r = await apiFetch(`/api/admin/mygate-complaints?${p}`, { token });
      if (r.ok) {
        const d = await r.json();
        setItems(d.items);
        setTotal(d.total);
        setTotalPages(d.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [token, open, category, q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => setPage(1), [open, category, q]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1.5 text-sm text-slate-400 active:text-white">
        <ArrowLeft size={18} /> Back
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-white">MyGate Complaints</h1>
      <p className="mt-0.5 text-xs text-slate-400">Imported Help Desk snapshot</p>

      {/* Stat cards */}
      {a && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Total", v: a.total, c: "text-white" },
            { label: "Open", v: a.openCount, c: "text-blue-300" },
            { label: "Closed", v: a.closedCount, c: "text-emerald-300" },
            { label: "Avg", v: fmtMins(a.avgResolutionMinutes), c: "text-amber-300" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-2 text-center">
              <div className="text-[10px] text-slate-400">{s.label}</div>
              <div className={`text-base font-bold ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {a && (
        <div className="mt-3 space-y-2">
          <Bars title="By status" data={a.byStatus} color="bg-blue-500" />
          <Bars title="By category" data={a.byCategory} color="bg-indigo-500" />
          <Bars title="By block" data={a.byBlock} color="bg-emerald-500" />
          <Bars title="Per month" data={a.byMonth.map((m) => ({ label: m.month.slice(2), count: m.count }))} color="bg-purple-500" />
        </div>
      )}

      {/* Filters */}
      <div className="mt-4 space-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject, resident, flat…"
          className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <div className="flex gap-2">
          <select value={open} onChange={(e) => setOpen(e.target.value)} className="flex-1 rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-2 text-sm text-white">
            <option value="">All</option>
            <option value="true">Open</option>
            <option value="false">Closed</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-2 text-sm text-white">
            <option value="">Any category</option>
            {a?.byCategory.map((c) => <option key={c.label} value={String(c.label)}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <p className="mt-3 text-[11px] text-slate-500">{loading ? "Loading…" : `${total} complaint(s)`}</p>
      <div className="mt-1 space-y-1.5">
        {items.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-700 bg-slate-800/60">
            <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{c.subject}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">#{c.mygateId} · {c.flatRaw ?? "—"} · {c.category ?? "—"} · {fmtDate(c.mygateCreatedAt)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLS[c.status] ?? "bg-slate-600/40 text-slate-300"}`}>{c.status}</span>
              {expanded === c.id ? <ChevronUp size={14} className="mt-1 text-slate-500" /> : <ChevronDown size={14} className="mt-1 text-slate-500" />}
            </button>
            {expanded === c.id && (
              <div className="border-t border-slate-700 px-3 py-2 text-[11px] text-slate-400 space-y-1">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>By: <b className="text-slate-200">{c.createdBy ?? "—"}</b></span>
                  <span>Assignee: <b className="text-slate-200">{c.assignee ?? "—"}</b></span>
                  <span>Resolution: <b className="text-slate-200">{fmtMins(c.resolutionMinutes)}</b></span>
                  <span>Closed: <b className="text-slate-200">{fmtDate(c.closedAt)}</b></span>
                </div>
                {c.comments && <p>{c.comments}</p>}
              </div>
            )}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-6 text-center text-sm text-slate-400">No complaints match.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40">Prev</button>
          <span className="text-sm text-slate-400">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
