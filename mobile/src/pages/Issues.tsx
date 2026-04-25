import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  CircleDot,
  Plus,
  Wrench,
  type LucideIcon,
  Zap,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Issue = {
  id: string;
  title: string;
  description: string;
  category: "ELECTRICAL" | "PLUMBING" | "OTHER";
  status: "OPEN" | "CLOSED";
  closureComment: string | null;
  closedAt: string | null;
  createdAt: string;
  resident: { name: string; block: number; flatNumber: string };
  closedByResident: { name: string } | null;
};

type Filter = "OPEN" | "CLOSED" | "ALL";

const CAT_META: Record<
  Issue["category"],
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

export default function IssuesPage() {
  const { token } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [canRaise, setCanRaise] = useState(true);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/issues", { token })
      .then((r) =>
        r.ok ? r.json() : { issues: [], isManager: false, canRaise: true }
      )
      .then((data) => {
        if (cancelled) return;
        setIssues(data.issues ?? []);
        setIsManager(!!data.isManager);
        setCanRaise(data.canRaise !== false);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return issues;
    return issues.filter((i) => i.status === filter);
  }, [issues, filter]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Link
            to="/more"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-white">Issues</h1>
        </div>
        {canRaise && (
          <Link
            to="/issues/new"
            className="inline-flex items-center gap-1 rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white active:bg-indigo-600"
          >
            <Plus size={14} />
            Raise
          </Link>
        )}
      </header>

      {isManager && (
        <p className="mb-3 inline-flex w-full justify-center text-[11px] text-amber-300">
          Manager view: showing all residents' issues.
        </p>
      )}

      <div className="mb-4 flex justify-center">
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <Tab active={filter === "OPEN"} onClick={() => setFilter("OPEN")}>
            Open
          </Tab>
          <Tab active={filter === "CLOSED"} onClick={() => setFilter("CLOSED")}>
            Closed
          </Tab>
          <Tab active={filter === "ALL"} onClick={() => setFilter("ALL")}>
            All
          </Tab>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <CircleDot size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">
            {filter === "OPEN"
              ? "No open issues."
              : filter === "CLOSED"
                ? "No closed issues yet."
                : "No issues yet."}
          </p>
          {canRaise && filter === "OPEN" && (
            <Link
              to="/issues/new"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-400"
            >
              <Plus size={12} /> Raise an issue
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {filtered.map((issue) => (
            <Link
              key={issue.id}
              to={`/issues/${issue.id}`}
              className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 active:bg-slate-800"
            >
              <CategoryBadge category={issue.category} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white">
                    {issue.title}
                  </p>
                  <StatusPill status={issue.status} />
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                  {issue.description}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {isManager
                    ? `${issue.resident.name} · Block ${issue.resident.block}, ${issue.resident.flatNumber} · `
                    : ""}
                  {formatDate(issue.createdAt)}
                </p>
              </div>
              <ChevronRight size={16} className="mt-1 text-slate-500" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-slate-700 text-white shadow-sm" : "text-slate-400"
      )}
    >
      {children}
    </button>
  );
}

function CategoryBadge({ category }: { category: Issue["category"] }) {
  const meta = CAT_META[category];
  const Icon = meta.icon;
  return (
    <div
      className={clsx(
        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
        meta.tint
      )}
    >
      <Icon size={16} />
    </div>
  );
}

function StatusPill({ status }: { status: Issue["status"] }) {
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
