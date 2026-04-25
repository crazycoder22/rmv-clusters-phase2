import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, ChevronRight, Lock } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type PollSummary = {
  id: string;
  title: string;
  description: string | null;
  type: "SINGLE" | "MULTIPLE";
  isAnonymous: boolean;
  deadline: string;
  status: "ACTIVE" | "CLOSED";
  createdBy: { name: string; block: number; flatNumber: string };
  options: { id: string; text: string }[];
  _count: { votes: number };
  createdAt: string;
};

type Filter = "ACTIVE" | "CLOSED" | "ALL";

export default function PollsPage() {
  const { token } = useAuth();
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/polls", { token })
      .then((r) => (r.ok ? r.json() : { polls: [] }))
      .then((data) => {
        if (!cancelled) setPolls(data.polls ?? []);
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
    const now = Date.now();
    return polls.filter((p) => {
      const expired =
        p.status === "CLOSED" || new Date(p.deadline).getTime() < now;
      if (filter === "ACTIVE") return !expired;
      if (filter === "CLOSED") return expired;
      return true;
    });
  }, [polls, filter]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Polls</h1>
      </header>

      <div className="mb-4 flex justify-center">
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <Tab active={filter === "ACTIVE"} onClick={() => setFilter("ACTIVE")}>
            Active
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
          <BarChart3 size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">
            {filter === "ACTIVE" ? "No active polls right now." : "No polls."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {filtered.map((p) => {
            const expired =
              p.status === "CLOSED" || new Date(p.deadline).getTime() < Date.now();
            return (
              <Link
                key={p.id}
                to={`/polls/${p.id}`}
                className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 active:bg-slate-800"
              >
                <div
                  className={clsx(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                    expired
                      ? "bg-slate-700 text-slate-400"
                      : "bg-violet-500/20 text-violet-300"
                  )}
                >
                  {expired ? <Lock size={14} /> : <BarChart3 size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">
                      {p.title}
                    </p>
                    {expired && (
                      <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                        Closed
                      </span>
                    )}
                    {!expired && p.type === "MULTIPLE" && (
                      <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                        Multi
                      </span>
                    )}
                    {p.isAnonymous && (
                      <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                        Anon
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                      {p.description}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-slate-500">
                    {p._count.votes} vote{p._count.votes === 1 ? "" : "s"} ·{" "}
                    {expired ? "Ended" : "Ends"} {formatDate(p.deadline)}
                  </p>
                </div>
                <ChevronRight size={16} className="mt-1 text-slate-500" />
              </Link>
            );
          })}
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
