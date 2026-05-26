import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Filter,
  Loader2,
  Search,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageIssues } from "../lib/roles";

// ── Types ───────────────────────────────────────────────────────────────────

type Category = "ELECTRICAL" | "PLUMBING" | "OTHER";
type Status = "OPEN" | "CLOSED";

interface Issue {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: Status;
  closureComment: string | null;
  closedAt: string | null;
  createdAt: string;
  resident: { name: string; block: number; flatNumber: string };
  closedByResident: { name: string } | null;
}

type StatusFilter = "" | "OPEN" | "CLOSED";
type BlockFilter = "" | "1" | "2" | "3" | "4";
type CategoryFilter = "" | Category;

// ── Category meta ──────────────────────────────────────────────────────────

const CAT_META: Record<
  Category,
  { label: string; icon: LucideIcon; tint: string }
> = {
  ELECTRICAL: {
    label: "Electrical",
    icon: Zap,
    tint: "bg-amber-500/20 text-amber-300",
  },
  PLUMBING: {
    label: "Plumbing",
    icon: Wrench,
    tint: "bg-sky-500/20 text-sky-300",
  },
  OTHER: {
    label: "Other",
    icon: CircleDot,
    tint: "bg-slate-700 text-slate-300",
  },
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminIssues() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Role gate — bounce non-managers. Server-side enforcement still applies.
  useEffect(() => {
    if (user && !canManageIssues(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters — default to Open since that's the actionable bucket.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [blockFilter, setBlockFilter] = useState<BlockFilter>("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/issues", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      setIssues(data.issues ?? []);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Stats — calculated client-side from the full list.
  const stats = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let open = 0;
    let closedThisWeek = 0;
    for (const i of issues) {
      if (i.status === "OPEN") open++;
      else if (i.closedAt && new Date(i.closedAt).getTime() >= oneWeekAgo) {
        closedThisWeek++;
      }
    }
    return { open, closedThisWeek, total: issues.length };
  }, [issues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (blockFilter && String(i.resident.block) !== blockFilter) return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (q) {
        const hay =
          `${i.title} ${i.description} ${i.resident.name} ${i.resident.flatNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [issues, search, statusFilter, blockFilter, categoryFilter]);

  const activeFilterCount =
    (blockFilter ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (statusFilter !== "OPEN" ? 1 : 0);

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
          <h1 className="text-lg font-semibold text-white">Issues</h1>
          <p className="truncate text-[11px] text-slate-500">
            {stats.open} open · {stats.closedThisWeek} closed this week
          </p>
        </div>
      </header>

      {/* Summary cards */}
      <section className="mb-3 grid grid-cols-3 gap-2">
        <Stat
          value={stats.open}
          label="open"
          icon={CircleDot}
          tint="bg-amber-500/15 text-amber-200"
        />
        <Stat
          value={stats.closedThisWeek}
          label="closed (7d)"
          icon={CheckCircle2}
          tint="bg-emerald-500/15 text-emerald-200"
        />
        <Stat
          value={stats.total}
          label="total"
          icon={Filter}
          tint="bg-slate-700 text-slate-300"
        />
      </section>

      {/* Search + filter toggle */}
      <section className="mb-3 flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3">
          <Search size={14} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, flat, name…"
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
              Status
            </p>
            <FilterChips
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={[
                { value: "OPEN", label: "Open" },
                { value: "CLOSED", label: "Closed" },
                { value: "", label: "All" },
              ]}
            />
          </div>
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
              Category
            </p>
            <FilterChips
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v as CategoryFilter)}
              options={[
                { value: "", label: "All" },
                { value: "ELECTRICAL", label: "Electrical" },
                { value: "PLUMBING", label: "Plumbing" },
                { value: "OTHER", label: "Other" },
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
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            {issues.length === 0
              ? "No issues yet."
              : "No issues match these filters."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
            <p className="pt-2 text-center text-[11px] text-slate-500">
              Showing {filtered.length} of {issues.length}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  icon: Icon,
  tint,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div
        className={clsx(
          "mb-1 flex h-7 w-7 items-center justify-center rounded-full",
          tint
        )}
      >
        <Icon size={14} />
      </div>
      <p className="text-lg font-bold leading-tight tabular-nums text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
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
          key={opt.value || "_all"}
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

function IssueCard({ issue }: { issue: Issue }) {
  const meta = CAT_META[issue.category];
  const Icon = meta.icon;
  const ageHours =
    (Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60);
  const isStale = issue.status === "OPEN" && ageHours > 72; // >3 days

  return (
    <Link
      to={`/issues/${issue.id}`}
      className={clsx(
        "flex items-start gap-3 rounded-2xl border p-3 active:bg-slate-800",
        issue.status === "CLOSED"
          ? "border-slate-700 bg-slate-800/40"
          : isStale
            ? "border-red-700/50 bg-red-900/10"
            : "border-slate-700 bg-slate-800/60"
      )}
    >
      <div
        className={clsx(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
          meta.tint
        )}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {issue.title}
          </h3>
          <StatusPill status={issue.status} />
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
          {issue.description}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          {issue.resident.name} · B{issue.resident.block} ·{" "}
          {issue.resident.flatNumber}
          <span className="text-slate-600"> · </span>
          {formatRelative(issue.createdAt)}
          {isStale && (
            <span className="ml-1 font-semibold text-red-400">· overdue</span>
          )}
        </p>
      </div>
      <ChevronRight size={16} className="mt-1 text-slate-500" />
    </Link>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === "CLOSED") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-bold text-green-300">
        <CheckCircle2 size={9} /> Closed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
      Open
    </span>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
