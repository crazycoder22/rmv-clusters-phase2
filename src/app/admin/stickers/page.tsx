"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft,
  ShieldCheck,
  Car,
  Bike,
  Users,
  Download,
  Search,
  CheckCircle2,
  Circle,
  ExternalLink,
  Trash2,
  Smartphone,
  HandCoins,
  BookOpen,
} from "lucide-react";
import clsx from "clsx";

interface StickerRow {
  id: string;
  block: number;
  flatNumber: string;
  residentName: string;
  phone: string;
  email: string | null;
  residentType: string;
  fourWheelers: number;
  twoWheelers: number;
  notes: string | null;
  mygateRegistered: boolean;
  alreadyHasSticker: boolean;
  stickersIssued: boolean;
  issuedAt: string | null;
  issuedBy: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Totals {
  fourWheelers: number;
  twoWheelers: number;
  flats: number;
  issued: number;
  mygateConfirmed: number;
  selfCollected: number;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

export default function AdminStickersPage() {
  const {
    canIssueStickers,
    canManageAnnouncements,
    isLoading: roleLoading,
  } = useRole();
  // Admin = can delete; facility manager = view + issue only.
  const canDelete = canManageAnnouncements();
  const router = useRouter();

  const [rows, setRows] = useState<StickerRow[]>([]);
  const [totals, setTotals] = useState<Totals>({
    fourWheelers: 0,
    twoWheelers: 0,
    flats: 0,
    issued: 0,
    mygateConfirmed: 0,
    selfCollected: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState<"" | "1" | "2" | "3" | "4">(
    ""
  );
  const [issuedFilter, setIssuedFilter] = useState<"" | "issued" | "pending">(
    ""
  );
  const [mygateFilter, setMygateFilter] = useState<"" | "yes" | "no">("");

  useEffect(() => {
    if (!roleLoading && !canIssueStickers()) router.replace("/");
  }, [roleLoading, canIssueStickers, router]);

  // Refresh handler — used both on mount and after admin actions. All setState
  // calls live inside async callbacks, so this is safe to invoke from an
  // effect body without tripping the react-hooks/set-state-in-effect rule.
  const refresh = () => {
    fetch("/api/admin/stickers")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setTotals(
          d.totals ?? {
            fourWheelers: 0,
            twoWheelers: 0,
            flats: 0,
            issued: 0,
            mygateConfirmed: 0,
            selfCollected: 0,
          }
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(refresh, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (blockFilter && String(r.block) !== blockFilter) return false;
      if (issuedFilter === "issued" && !r.stickersIssued) return false;
      if (issuedFilter === "pending" && r.stickersIssued) return false;
      if (mygateFilter === "yes" && !r.mygateRegistered) return false;
      if (mygateFilter === "no" && r.mygateRegistered) return false;
      if (q) {
        const blob =
          `${r.block} ${r.flatNumber} ${r.residentName} ${r.phone} ${r.email ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, blockFilter, issuedFilter, mygateFilter]);

  async function toggleIssued(row: StickerRow) {
    const next = !row.stickersIssued;
    // Optimistic update.
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              stickersIssued: next,
              issuedAt: next ? new Date().toISOString() : null,
            }
          : r
      )
    );
    const res = await fetch("/api/admin/stickers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, stickersIssued: next }),
    });
    if (!res.ok) {
      alert("Could not update — refresh and try again.");
      refresh();
    } else {
      refresh(); // refresh totals
    }
  }

  async function deleteRow(row: StickerRow) {
    if (
      !confirm(
        `Delete sticker request for Block ${row.block}, Flat ${row.flatNumber} (${row.residentName})?`
      )
    )
      return;
    const res = await fetch(`/api/admin/stickers?id=${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("Could not delete — try again.");
      return;
    }
    refresh();
  }

  if (roleLoading || loading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> Back home
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Vehicle Stickers
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Requests from the public form at{" "}
                <Link
                  href="/stickers"
                  target="_blank"
                  className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                >
                  /stickers
                  <ExternalLink size={11} />
                </Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/stickers/guide"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
            >
              <BookOpen size={16} />
              Manager guide
            </Link>
            <a
              href="/api/admin/stickers?format=csv"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            >
              <Download size={16} />
              Export CSV
            </a>
          </div>
        </div>

        {/* Totals (KPI cards) — Row 1: demand */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <KpiCard
            icon={<Car size={18} />}
            label="4-Wheeler stickers"
            value={totals.fourWheelers}
            tone="indigo"
          />
          <KpiCard
            icon={<Bike size={18} />}
            label="2-Wheeler stickers"
            value={totals.twoWheelers}
            tone="emerald"
          />
          <KpiCard
            icon={<Users size={18} />}
            label="Flats responded"
            value={totals.flats}
            tone="sky"
          />
          <KpiCard
            icon={<CheckCircle2 size={18} />}
            label="Stickers issued"
            value={`${totals.issued} / ${totals.flats}`}
            tone="amber"
          />
        </div>
        {/* Row 2: self-reported status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <KpiCard
            icon={<Smartphone size={18} />}
            label="MyGate confirmed (self-reported)"
            value={`${totals.mygateConfirmed} / ${totals.flats}`}
            tone="sky"
          />
          <KpiCard
            icon={<HandCoins size={18} />}
            label="Already collected (self-reported)"
            value={totals.selfCollected}
            tone="amber"
          />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search name, flat, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm"
            />
          </div>
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value as typeof blockFilter)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm"
          >
            <option value="">All blocks</option>
            <option value="1">Block 1</option>
            <option value="2">Block 2</option>
            <option value="3">Block 3</option>
            <option value="4">Block 4</option>
          </select>
          <select
            value={issuedFilter}
            onChange={(e) =>
              setIssuedFilter(e.target.value as typeof issuedFilter)
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm"
          >
            <option value="">All status</option>
            <option value="pending">Not yet issued</option>
            <option value="issued">Issued</option>
          </select>
          <select
            value={mygateFilter}
            onChange={(e) =>
              setMygateFilter(e.target.value as typeof mygateFilter)
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm"
          >
            <option value="">MyGate: all</option>
            <option value="yes">MyGate: confirmed</option>
            <option value="no">MyGate: pending</option>
          </select>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length} of {rows.length}
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {rows.length === 0
              ? "No sticker requests yet. Share the link /stickers with residents."
              : "No matching rows. Adjust the filters."}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-3 font-medium">Flat</th>
                  <th className="px-3 py-3 font-medium">Resident</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium text-right">4W</th>
                  <th className="px-3 py-3 font-medium text-right">2W</th>
                  <th className="px-3 py-3 font-medium">Submitted</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        B{r.block}-{r.flatNumber}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {r.residentName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {r.phone}
                        {r.email ? ` · ${r.email}` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.mygateRegistered ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                            <Smartphone size={9} /> MyGate ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                            <Smartphone size={9} /> MyGate ?
                          </span>
                        )}
                        {r.alreadyHasSticker && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            <HandCoins size={9} /> Self-collected
                          </span>
                        )}
                      </div>
                      {r.notes && (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300 italic">
                          &ldquo;{r.notes}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={clsx(
                          "inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider",
                          r.residentType === "OWNER"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        )}
                      >
                        {r.residentType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {r.fourWheelers}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {r.twoWheelers}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                      {r.updatedAt !== r.createdAt && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">
                          edited {fmtDate(r.updatedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {(() => {
                        const isSelfCollected =
                          r.stickersIssued && r.issuedBy === "self-declared";
                        return (
                          <button
                            onClick={() => toggleIssued(r)}
                            className={clsx(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-colors",
                              isSelfCollected
                                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                                : r.stickersIssued
                                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                                  : "bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100"
                            )}
                            title={
                              isSelfCollected
                                ? "Resident self-declared they already have the stickers. Click to override."
                                : r.stickersIssued
                                  ? "Stickers handed over by admin. Click to mark as pending."
                                  : "Not yet issued. Click to mark as issued."
                            }
                          >
                            {isSelfCollected ? (
                              <>
                                <HandCoins size={12} /> Self-collected
                              </>
                            ) : r.stickersIssued ? (
                              <>
                                <CheckCircle2 size={12} /> Issued
                              </>
                            ) : (
                              <>
                                <Circle size={12} /> Pending
                              </>
                            )}
                          </button>
                        );
                      })()}
                      {r.stickersIssued && r.issuedAt && (
                        <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                          by {r.issuedBy ?? "admin"} · {fmtDate(r.issuedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {canDelete && (
                        <button
                          onClick={() => deleteRow(r)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-700">
                <tr className="font-semibold text-gray-700 dark:text-gray-200">
                  <td className="px-3 py-2.5 text-xs uppercase tracking-wider" colSpan={3}>
                    Totals ({filtered.length} flats)
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {filtered.reduce((s, r) => s + r.fourWheelers, 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {filtered.reduce((s, r) => s + r.twoWheelers, 0)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "indigo" | "emerald" | "sky" | "amber";
}) {
  const tones = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
    sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div
        className={clsx(
          "inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2",
          tones[tone]
        )}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
