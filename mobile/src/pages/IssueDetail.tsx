import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Loader2,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Category = "ELECTRICAL" | "PLUMBING" | "OTHER";

type Issue = {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: "OPEN" | "CLOSED";
  closureComment: string | null;
  closedAt: string | null;
  createdAt: string;
  resident: { name: string; block: number; flatNumber: string };
  closedByResident: { name: string } | null;
};

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

export default function IssueDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closureComment, setClosureComment] = useState("");
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/issues/${id}`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load");
        return;
      }
      const data = await res.json();
      setIssue(data.issue);
      setIsManager(!!data.isManager);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const close = async () => {
    if (!closureComment.trim()) {
      setError("Please add a closure comment.");
      return;
    }
    setClosing(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/issues/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ closureComment: closureComment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to close");
        return;
      }
      setClosureComment("");
      refresh();
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/issues"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Issue</h1>
      </header>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : !issue ? (
        <p className="py-10 text-center text-sm text-red-400">
          {error ?? "Not found"}
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
            <div className="flex items-start gap-3">
              <CategoryBadge category={issue.category} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-base font-semibold text-white">
                    {issue.title}
                  </p>
                  <StatusPill status={issue.status} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {issue.resident.name} · Block {issue.resident.block},{" "}
                  {issue.resident.flatNumber} · {formatDate(issue.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-sm leading-relaxed text-slate-200">
              {issue.description}
            </div>
          </div>

          {issue.status === "CLOSED" && (
            <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-green-300">
                <CheckCircle2 size={14} />
                Closed
                {issue.closedByResident && (
                  <span className="text-xs font-normal text-green-400/70">
                    by {issue.closedByResident.name}
                  </span>
                )}
                {issue.closedAt && (
                  <span className="text-xs font-normal text-green-400/70">
                    · {formatDate(issue.closedAt)}
                  </span>
                )}
              </div>
              {issue.closureComment && (
                <p className="text-sm leading-relaxed text-green-100/90">
                  {issue.closureComment}
                </p>
              )}
            </div>
          )}

          {issue.status === "OPEN" && isManager && (
            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
              <h2 className="mb-2 text-sm font-semibold text-white">
                Close this issue
              </h2>
              <textarea
                value={closureComment}
                onChange={(e) => setClosureComment(e.target.value)}
                placeholder="Add a closure note (e.g. 'Replaced fuse, working again')"
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
              />
              {error && (
                <p className="mt-2 text-xs text-red-400">{error}</p>
              )}
              <button
                onClick={close}
                disabled={closing || !closureComment.trim()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 py-2.5 text-sm font-semibold text-white active:bg-green-600 disabled:opacity-50"
              >
                {closing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Closing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Mark as closed
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  const meta = CAT_META[category];
  const Icon = meta.icon;
  return (
    <div
      className={clsx(
        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
        meta.tint
      )}
    >
      <Icon size={18} />
    </div>
  );
}

function StatusPill({ status }: { status: "OPEN" | "CLOSED" }) {
  if (status === "CLOSED") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-bold text-green-300">
        <CheckCircle2 size={10} /> Closed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
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
