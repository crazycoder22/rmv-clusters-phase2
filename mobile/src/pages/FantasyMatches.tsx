import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, Users } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";

type Status = "OPEN" | "LOCKED" | "COMPLETED";

type Match = {
  id: string;
  title: string;
  opponent: string;
  venue: string;
  matchDate: string;
  status: Status;
  _count: { players: number; teams: number };
};

export default function FantasyMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/fantasy/matches")
      .then((r) => (r.ok ? r.json() : { matches: [] }))
      .then((data) => {
        if (!cancelled) setMatches(data.matches ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Fantasy Cricket</h1>
        <div className="h-9 w-9" />
      </header>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : matches.length === 0 ? (
        <div className="py-16 text-center">
          <Trophy size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No matches scheduled.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <Link
              key={m.id}
              to={`/fantasy/${m.id}`}
              className="block rounded-2xl border border-slate-700 bg-slate-800/60 p-4 active:bg-slate-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{m.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    vs {m.opponent} · {m.venue}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {m._count.teams} teams
                </span>
                <span>
                  {new Date(m.matchDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    OPEN: "bg-green-500/20 text-green-300",
    LOCKED: "bg-amber-500/20 text-amber-300",
    COMPLETED: "bg-slate-700 text-slate-400",
  };
  const label =
    status === "OPEN" ? "Open" : status === "LOCKED" ? "Locked" : "Completed";
  return (
    <span
      className={clsx(
        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        map[status]
      )}
    >
      {label}
    </span>
  );
}
