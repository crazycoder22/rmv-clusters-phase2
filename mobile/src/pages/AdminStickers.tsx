import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  Car,
  Check,
  CheckCircle2,
  Circle,
  Filter,
  Loader2,
  Phone,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canIssueStickers, canManageAnnouncements } from "../lib/roles";

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
}

interface Totals {
  fourWheelers: number;
  twoWheelers: number;
  flats: number;
  issued: number;
  mygateConfirmed: number;
  selfCollected: number;
}

type BlockFilter = "" | "1" | "2" | "3" | "4";
type IssuedFilter = "" | "issued" | "pending";

export default function AdminStickers() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Role gate — bounce non-staff back to More. The same gate is enforced
  // server-side, but redirecting locally keeps the UX consistent for users
  // who landed here via a deep link.
  useEffect(() => {
    if (user && !canIssueStickers(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const canDelete = canManageAnnouncements(user?.roles);

  const [rows, setRows] = useState<StickerRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState<BlockFilter>("");
  const [issuedFilter, setIssuedFilter] = useState<IssuedFilter>("pending");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const refresh = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await apiFetch("/api/admin/stickers", { token });
        if (!res.ok) {
          setError(res.status === 403 ? "Not authorised" : "Could not load");
          return;
        }
        const data = await res.json();
        setRows(data.rows ?? []);
        setTotals(data.totals ?? null);
        setError(null);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Toggle issued — optimistic update so the tap feels instant. If the
  // server rejects we re-fetch to undo.
  async function toggleIssued(row: StickerRow) {
    setBusyId(row.id);
    const next = !row.stickersIssued;
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              stickersIssued: next,
              issuedAt: next ? new Date().toISOString() : null,
              issuedBy: next ? user?.name ?? "you" : null,
            }
          : r
      )
    );
    try {
      const res = await apiFetch("/api/admin/stickers", {
        method: "PATCH",
        token,
        body: JSON.stringify({ id: row.id, stickersIssued: next }),
      });
      if (!res.ok) {
        // Re-fetch from server to roll back the optimistic write.
        await refresh(true);
      }
    } catch {
      await refresh(true);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRow(row: StickerRow) {
    if (!canDelete) return;
    if (
      !confirm(
        `Delete the sticker request for B${row.block} ${row.flatNumber}? This can't be undone.`
      )
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      const res = await apiFetch(
        `/api/admin/stickers?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE", token }
      );
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      }
    } finally {
      setBusyId(null);
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (blockFilter && String(r.block) !== blockFilter) return false;
      if (issuedFilter === "issued" && !r.stickersIssued) return false;
      if (issuedFilter === "pending" && r.stickersIssued) return false;
      if (q) {
        const hay = `${r.residentName} ${r.flatNumber} ${r.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, blockFilter, issuedFilter]);

  const activeFilterCount =
    (blockFilter ? 1 : 0) + (issuedFilter !== "pending" ? 1 : 0);

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
          <h1 className="text-lg font-semibold text-white">Sticker requests</h1>
          {totals && (
            <p className="truncate text-[11px] text-slate-500">
              {totals.flats} flat{totals.flats !== 1 ? "s" : ""} ·{" "}
              {totals.issued} issued · {totals.flats - totals.issued} pending
            </p>
          )}
        </div>
        {refreshing && (
          <Loader2 size={16} className="animate-spin text-slate-500" />
        )}
      </header>

      {/* Summary cards */}
      {totals && (
        <section className="grid grid-cols-3 gap-2 mb-3">
          <Stat
            value={totals.fourWheelers}
            label="cars"
            icon={Car}
            tint="bg-indigo-500/15 text-indigo-200"
          />
          <Stat
            value={totals.twoWheelers}
            label="bikes"
            icon={Bike}
            tint="bg-emerald-500/15 text-emerald-200"
          />
          <Stat
            value={totals.mygateConfirmed}
            label="MyGate ok"
            icon={Smartphone}
            tint="bg-amber-500/15 text-amber-200"
          />
        </section>
      )}

      {/* Search + filter toggle */}
      <section className="mb-3 flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3">
          <Search size={14} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, flat, phone"
            className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-slate-500"
              aria-label="Clear"
            >
              <X size={14} />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={clsx(
            "relative flex h-11 w-11 items-center justify-center rounded-2xl border",
            filtersOpen || activeFilterCount > 0
              ? "border-indigo-400 bg-indigo-500/20 text-indigo-100"
              : "border-slate-700 bg-slate-800/60 text-slate-300 active:bg-slate-800"
          )}
          aria-label="Filters"
        >
          <Filter size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </section>

      {filtersOpen && (
        <section className="mb-3 space-y-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Block
            </p>
            <FilterChips
              value={blockFilter}
              onChange={(v) => setBlockFilter(v as BlockFilter)}
              options={[
                { value: "", label: "All" },
                { value: "1", label: "B1" },
                { value: "2", label: "B2" },
                { value: "3", label: "B3" },
                { value: "4", label: "B4" },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Status
            </p>
            <FilterChips
              value={issuedFilter}
              onChange={(v) => setIssuedFilter(v as IssuedFilter)}
              options={[
                { value: "", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "issued", label: "Issued" },
              ]}
            />
          </div>
        </section>
      )}

      {/* List */}
      <section className="flex-1 pb-4">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            {rows.length === 0
              ? "No sticker submissions yet."
              : "No requests match these filters."}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRows.map((r) => (
              <RowCard
                key={r.id}
                row={r}
                busy={busyId === r.id}
                onToggle={() => toggleIssued(r)}
                onDelete={canDelete ? () => deleteRow(r) : undefined}
              />
            ))}
            <p className="pt-2 text-center text-[11px] text-slate-500">
              Showing {filteredRows.length} of {rows.length}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Stat({
  value,
  label,
  icon: Icon,
  tint,
}: {
  value: number;
  label: string;
  icon: typeof Car;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div className={clsx("mb-1 flex h-7 w-7 items-center justify-center rounded-full", tint)}>
        <Icon size={14} />
      </div>
      <p className="text-lg font-bold leading-tight tabular-nums text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function FilterChips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            "rounded-full px-3 py-1.5 text-xs font-medium",
            value === opt.value
              ? "bg-indigo-500 text-white"
              : "bg-slate-900 text-slate-300 active:bg-slate-800"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RowCard({
  row,
  busy,
  onToggle,
  onDelete,
}: {
  row: StickerRow;
  busy: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const total = row.fourWheelers + row.twoWheelers;
  const issuedAt = row.issuedAt
    ? new Date(row.issuedAt).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <article
      className={clsx(
        "rounded-2xl border p-3",
        row.stickersIssued
          ? "border-emerald-700/50 bg-emerald-900/10"
          : "border-slate-700 bg-slate-800/60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Issue toggle (big tap target on the left) */}
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-label={
            row.stickersIssued ? "Mark as not issued" : "Mark as issued"
          }
          className={clsx(
            "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors",
            row.stickersIssued
              ? "bg-emerald-500 text-white active:bg-emerald-600"
              : "border border-slate-600 bg-slate-900 text-slate-500 active:bg-slate-800",
            busy && "opacity-50"
          )}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : row.stickersIssued ? (
            <CheckCircle2 size={18} />
          ) : (
            <Circle size={18} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Name + flat header */}
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-white">
              {row.residentName}
            </h3>
            <span className="shrink-0 text-[11px] font-mono text-slate-400">
              B{row.block} · {row.flatNumber}
            </span>
          </div>

          {/* Type + counts row */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
            <span className="capitalize">{row.residentType.toLowerCase()}</span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1">
              <Car size={11} /> {row.fourWheelers}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bike size={11} /> {row.twoWheelers}
            </span>
            <span className="text-slate-500">({total} stickers)</span>
          </div>

          {/* Phone link (tap to call) */}
          <a
            href={`tel:${row.phone}`}
            className="mt-1 inline-flex items-center gap-1 text-[12px] text-indigo-300 active:underline"
          >
            <Phone size={11} />
            {row.phone}
          </a>

          {/* Status badges */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.mygateRegistered && (
              <Badge color="amber" icon={Smartphone}>
                MyGate ✓
              </Badge>
            )}
            {row.alreadyHasSticker && (
              <Badge color="slate" icon={Check}>
                Self-collected
              </Badge>
            )}
            {row.stickersIssued && issuedAt && (
              <Badge color="emerald" icon={ShieldCheck}>
                Issued {issuedAt}
              </Badge>
            )}
          </div>

          {/* Notes from resident */}
          {row.notes && (
            <p className="mt-2 rounded-lg bg-slate-900/60 px-2.5 py-1.5 text-[11px] italic text-slate-400">
              "{row.notes}"
            </p>
          )}
        </div>

        {/* Delete (admin-only) */}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete row"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-600 active:bg-slate-800 active:text-red-300"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </article>
  );
}

function Badge({
  color,
  icon: Icon,
  children,
}: {
  color: "amber" | "emerald" | "slate";
  icon: typeof Smartphone;
  children: React.ReactNode;
}) {
  const cls =
    color === "amber"
      ? "border-amber-700/50 bg-amber-900/30 text-amber-200"
      : color === "emerald"
        ? "border-emerald-700/50 bg-emerald-900/30 text-emerald-200"
        : "border-slate-700 bg-slate-900 text-slate-300";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        cls
      )}
    >
      <Icon size={10} />
      {children}
    </span>
  );
}
