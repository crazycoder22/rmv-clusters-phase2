"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Building2,
  ShieldCheck,
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserCheck,
  TrendingUp,
} from "lucide-react";

interface VisitLogItem {
  id: string;
  mygateId: string;
  visitDate: string;
  visitorName: string;
  visitorType: string;
  fromSource: string | null;
  block: number | null;
  flatNumber: string | null;
  flatRaw: string;
  inTime: string | null;
  outTime: string | null;
  approvedBy: string | null;
  allowedByGuard: string | null;
  approvedByResident: boolean;
}

interface StatsData {
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

function istYesterdayYmd(): string {
  // Default the date filter to yesterday (IST). Today's data is still partial
  // at scrape time, so yesterday is the most-recently-complete day.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export default function VisitLogTable({ adminView }: { adminView: boolean }) {
  const [dateFrom, setDateFrom] = useState<string>(istYesterdayYmd());
  const [dateTo, setDateTo] = useState<string>(istYesterdayYmd());
  const [fromSource, setFromSource] = useState("");
  const [guard, setGuard] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [residentApprovedOnly, setResidentApprovedOnly] = useState(false);

  const [items, setItems] = useState<VisitLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  const LIMIT = 50;

  const fetchList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("scope", adminView ? "all" : "mine");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (fromSource) params.set("fromSource", fromSource);
    if (guard) params.set("guard", guard);
    if (adminView && block) params.set("block", block);
    if (adminView && flatNumber) params.set("flatNumber", flatNumber);
    if (residentApprovedOnly) params.set("approvedByResident", "true");
    params.set("page", String(page));
    params.set("limit", String(LIMIT));
    try {
      const res = await fetch(`/api/visit-log?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, fromSource, guard, block, flatNumber, residentApprovedOnly, page, adminView]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [dateFrom, dateTo, fromSource, guard, block, flatNumber, residentApprovedOnly]);

  // Admin stats — re-fetch when date range changes
  useEffect(() => {
    if (!adminView) return;
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    fetch(`/api/visit-log/stats?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d))
      .catch(() => {});
  }, [adminView, dateFrom, dateTo]);

  // Trend data — fetch once on mount for admin
  useEffect(() => {
    if (!adminView) return;
    fetch("/api/visit-log/trend?days=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.trend) setTrend(d.trend); })
      .catch(() => {});
  }, [adminView]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      {/* Admin stats */}
      {adminView && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            icon={<Calendar size={18} />}
            label={dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`}
            value={stats.rangeCount}
            sublabel={
              stats.rangeCount > 0
                ? `${stats.rangeResidentApproved} resident-approved (${((stats.rangeResidentApproved / stats.rangeCount) * 100).toFixed(0)}%)`
                : undefined
            }
          />
        </div>
      )}

      {/* Per-block breakdown (last 30d) */}
      {adminView && stats && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            <Building2 size={14} />
            By block
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.byBlock.map((b) => (
              <StatCard
                key={b.block}
                icon={<Building2 size={18} />}
                label={`Block ${b.block}`}
                value={b.total}
                sublabel={
                  b.total > 0
                    ? `${b.residentApproved} resident-approved (${((b.residentApproved / b.total) * 100).toFixed(0)}%)`
                    : "no visits"
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Top lists (last 30d) */}
      {adminView && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TopList icon={<Package size={16} />} title="Top 3 Sources" items={stats.topSources.map((s) => ({ label: s.source || "—", count: s.count }))} />
          <TopList icon={<ShieldCheck size={16} />} title="Top 3 Guards" items={stats.topGuards.map((g) => ({ label: g.guard || "—", count: g.count }))} />
        </div>
      )}

      {/* Resident approval trend chart */}
      {adminView && trend.length > 1 && (
        <ResidentApprovalChart data={trend} />
      )}

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="From">
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </Field>
          {adminView && (
            <>
              <Field label="Block">
                <select
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </Field>
              <Field label="Flat">
                <input
                  type="text"
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  placeholder="e.g. 304"
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-24"
                />
              </Field>
            </>
          )}
          <Field label="Source">
            <input
              type="text"
              value={fromSource}
              onChange={(e) => setFromSource(e.target.value)}
              placeholder="e.g. Swiggy"
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-32"
            />
          </Field>
          <Field label="Guard">
            <input
              type="text"
              value={guard}
              onChange={(e) => setGuard(e.target.value)}
              placeholder="e.g. VASANTHAPPA"
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-40"
            />
          </Field>
          <button
            onClick={() => {
              const yesterday = istYesterdayYmd();
              setDateFrom(yesterday);
              setDateTo(yesterday);
              setFromSource("");
              setGuard("");
              setBlock("");
              setFlatNumber("");
              setResidentApprovedOnly(false);
            }}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            Reset
          </button>
        </div>

        {/* Secondary filters row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={residentApprovedOnly}
              onChange={(e) => setResidentApprovedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <UserCheck size={14} className="text-primary-600 dark:text-primary-400" />
            Resident-approved only
            <span className="text-xs text-gray-400 dark:text-gray-500">
              (hides entries where the guard approved without a resident)
            </span>
          </label>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{loading ? "Loading..." : `${total} entries`}</span>
        {totalPages > 1 && (
          <span>
            Page {page} of {totalPages}
          </span>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">In Time</th>
              <th className="px-4 py-3 text-left">Out Time</th>
              <th className="px-4 py-3 text-left">Visitor</th>
              <th className="px-4 py-3 text-left">From</th>
              <th className="px-4 py-3 text-left">Type</th>
              {adminView && <th className="px-4 py-3 text-left">Flat</th>}
              <th className="px-4 py-3 text-left">Approved By</th>
              <th className="px-4 py-3 text-left">Guard</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={adminView ? 8 : 7} className="px-4 py-12 text-center text-gray-400">
                  <Loader2 className="animate-spin inline mr-2" size={16} />
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={adminView ? 8 : 7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                  No visits recorded for this filter.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 tabular-nums">{formatTime(item.inTime)}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 tabular-nums">{formatTime(item.outTime)}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{item.visitorName}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{item.fromSource || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{item.visitorType}</td>
                  {adminView && (
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                      {item.block ? `B${item.block}-${item.flatNumber}` : item.flatRaw}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <span>{item.approvedBy || "—"}</span>
                      {item.approvedByResident && (
                        <UserCheck
                          size={12}
                          className="text-primary-600 dark:text-primary-400 flex-shrink-0"
                          aria-label="Resident approved"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{item.allowedByGuard || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400"><Loader2 className="animate-spin inline mr-2" size={16} />Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">No visits recorded for this filter.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{item.visitorName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.visitorType} · {item.fromSource || "—"}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-gray-900 dark:text-gray-100 tabular-nums">{formatTime(item.inTime)}</p>
                  {item.outTime && <p className="text-gray-400 tabular-nums">out {formatTime(item.outTime)}</p>}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                {adminView && <span>{item.block ? `B${item.block}-${item.flatNumber}` : item.flatRaw}</span>}
                <span>Approved: {item.approvedBy || "—"}</span>
                <span>Guard: {item.allowedByGuard || "—"}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  isString,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sublabel?: string;
  isString?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
        {icon}
        {label}
      </div>
      <div className={`font-semibold text-gray-900 dark:text-gray-100 ${isString ? "text-sm truncate" : "text-2xl tabular-nums"}`}>
        {value}
      </div>
      {sublabel && (
        <div className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}

function ResidentApprovalChart({ data }: { data: TrendPoint[] }) {
  const maxPct = 100;
  const chartHeight = 200;

  function formatDateLabel(dateStr: string) {
    const [, m, d] = dateStr.split("-");
    return `${parseInt(d)}/${parseInt(m)}`;
  }

  // Show every Nth label to avoid overlap
  const labelInterval = data.length > 15 ? Math.ceil(data.length / 10) : 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
        <TrendingUp size={14} />
        Resident Approval Trend (Last {data.length} days)
      </div>

      {/* Y-axis labels + chart area */}
      <div className="flex gap-2">
        {/* Y-axis */}
        <div className="flex flex-col justify-between text-xs text-gray-400 dark:text-gray-500 tabular-nums w-8 text-right" style={{ height: chartHeight }}>
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>

        {/* Chart */}
        <div className="flex-1 relative" style={{ height: chartHeight }}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => (
            <div
              key={pct}
              className="absolute w-full border-t border-gray-100 dark:border-gray-700"
              style={{ bottom: `${pct}%` }}
            />
          ))}

          {/* SVG line chart */}
          <svg
            viewBox={`0 0 ${data.length * 30} ${chartHeight}`}
            className="absolute inset-0 w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Area fill */}
            <path
              d={
                `M 0 ${chartHeight} ` +
                data.map((d, i) => {
                  const x = (i / (data.length - 1)) * 100;
                  const y = 100 - d.pct;
                  return `L ${x} ${y}`;
                }).join(" ") +
                ` L 100 ${chartHeight} Z`
              }
              fill="url(#approvalGradient)"
              vectorEffect="non-scaling-stroke"
              style={{ transform: "scaleX(1)" }}
            />
            {/* Line */}
            <path
              d={data.map((d, i) => {
                const x = (i / (data.length - 1)) * 100;
                const y = 100 - d.pct;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              }).join(" ")}
              fill="none"
              stroke="#16a34a"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <defs>
              <linearGradient id="approvalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
              </linearGradient>
            </defs>
          </svg>

          {/* Bars + tooltips */}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <div
                key={d.date}
                className="flex-1 relative group"
                style={{ height: "100%" }}
              >
                {/* Hover bar */}
                <div
                  className="absolute bottom-0 left-[10%] right-[10%] bg-primary-500/20 dark:bg-primary-400/20 rounded-t opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ height: `${d.pct}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                    <div className="font-medium">{formatDateLabel(d.date)}</div>
                    <div>{d.pct}% ({d.approved}/{d.total})</div>
                  </div>
                </div>
                {/* Dot */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-green-600 dark:bg-green-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ bottom: `${d.pct}%`, marginBottom: -4 }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex ml-10 mt-1">
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % labelInterval === 0 ? (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                {formatDateLabel(d.date)}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-green-600 dark:bg-green-400 rounded" />
          % visitors approved by residents
        </div>
        <div className="ml-auto tabular-nums">
          Avg: {data.length > 0 ? Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length) : 0}%
        </div>
      </div>
    </div>
  );
}

function TopList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: { label: string; count: number }[];
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">No data</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-gray-900 dark:text-gray-100 truncate">
                <span className="text-gray-400 mr-2">{i + 1}.</span>
                {item.label}
              </span>
              <span className="text-gray-500 dark:text-gray-400 tabular-nums text-xs">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
