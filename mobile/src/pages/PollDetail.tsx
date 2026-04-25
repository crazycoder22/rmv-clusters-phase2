import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Loader2,
  Lock,
  Send,
  UserX,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Voter = { name: string; block: number; flatNumber: string } | null;

type Option = {
  id: string;
  text: string;
  sortOrder: number;
  voteCount: number;
  voters: Voter[];
};

type Poll = {
  id: string;
  title: string;
  description: string | null;
  type: "SINGLE" | "MULTIPLE";
  isAnonymous: boolean;
  deadline: string;
  status: "ACTIVE" | "CLOSED";
  createdBy: { name: string; block: number; flatNumber: string };
  createdAt: string;
  totalVotes: number;
  options: Option[];
};

export default function PollDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [myVotes, setMyVotes] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/polls/${id}`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not load poll");
        return;
      }
      const data = await res.json();
      setPoll(data.poll);
      setMyVotes(data.myVotes ?? []);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const togglePick = (optId: string) => {
    if (!poll) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (poll.type === "SINGLE") {
        return new Set([optId]);
      }
      if (next.has(optId)) next.delete(optId);
      else next.add(optId);
      return next;
    });
  };

  const submit = async () => {
    if (!poll) return;
    if (picked.size === 0) {
      setError("Pick an option first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/polls/${id}/vote`, {
        method: "POST",
        token,
        body: JSON.stringify({ optionIds: Array.from(picked) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Vote failed");
        return;
      }
      setPicked(new Set());
      refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const expired =
    poll?.status === "CLOSED" ||
    (poll && new Date(poll.deadline).getTime() < Date.now());
  const hasVoted = myVotes.length > 0;
  const canVote = !expired && !hasVoted;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/polls"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Poll</h1>
      </header>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : !poll ? (
        <p className="py-10 text-center text-sm text-red-400">
          {error ?? "Not found"}
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {expired ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                  <Lock size={9} /> Closed
                </span>
              ) : (
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                  Active
                </span>
              )}
              {poll.type === "MULTIPLE" && (
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                  Pick multiple
                </span>
              )}
              {poll.isAnonymous && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                  <UserX size={9} /> Anonymous
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white">{poll.title}</h2>
            {poll.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {poll.description}
              </p>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"} ·{" "}
              {expired ? "Ended" : "Ends"} {formatDate(poll.deadline)} · by{" "}
              {poll.createdBy.name}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {poll.options.map((opt) => {
              const totalVotes = poll.totalVotes || 1;
              const pct = Math.round((opt.voteCount / totalVotes) * 100);
              const userVoted = myVotes.includes(opt.id);
              const isPicked = picked.has(opt.id);
              const showResults = !canVote;
              return (
                <div
                  key={opt.id}
                  className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60"
                >
                  <button
                    onClick={() => canVote && togglePick(opt.id)}
                    disabled={!canVote}
                    className={clsx(
                      "relative w-full px-4 py-3 text-left transition-colors",
                      canVote && "active:bg-slate-800",
                      isPicked && canVote && "bg-violet-500/10"
                    )}
                  >
                    {showResults && (
                      <div
                        className="absolute inset-y-0 left-0 transition-all"
                        style={{
                          width: `${pct}%`,
                          background: userVoted
                            ? "rgba(139, 92, 246, 0.18)"
                            : "rgba(71, 85, 105, 0.35)",
                        }}
                      />
                    )}
                    <div className="relative flex items-center gap-3">
                      {canVote ? (
                        <Pip
                          type={poll.type}
                          checked={isPicked}
                        />
                      ) : userVoted ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-white">
                          <Check size={12} />
                        </span>
                      ) : null}
                      <span className="flex-1 text-sm text-slate-100">
                        {opt.text}
                      </span>
                      {showResults && (
                        <>
                          <span className="text-xs text-slate-400">
                            {opt.voteCount}
                          </span>
                          <span className="w-10 text-right text-xs font-bold text-slate-300">
                            {pct}%
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                  {showResults &&
                    !poll.isAnonymous &&
                    opt.voters.length > 0 && (
                      <div className="border-t border-slate-700 bg-slate-900/40 px-4 py-2">
                        <p className="text-[10px] text-slate-500">
                          {opt.voters
                            .filter((v): v is NonNullable<Voter> => !!v)
                            .map(
                              (v) =>
                                `${v.name} (B${v.block}-${v.flatNumber})`
                            )
                            .join(", ")}
                        </p>
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {error}
            </p>
          )}

          {canVote && (
            <button
              onClick={submit}
              disabled={submitting || picked.size === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white active:bg-violet-600 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Voting…
                </>
              ) : (
                <>
                  <Send size={14} /> Submit vote
                </>
              )}
            </button>
          )}

          {hasVoted && !expired && (
            <p className="mt-4 text-center text-xs text-violet-300">
              ✓ You voted. Results update live.
            </p>
          )}
          {expired && (
            <p className="mt-4 text-center text-xs text-slate-500">
              <BarChart3 size={11} className="mr-1 inline" />
              Voting closed.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Pip({
  type,
  checked,
}: {
  type: "SINGLE" | "MULTIPLE";
  checked: boolean;
}) {
  if (type === "MULTIPLE") {
    return (
      <span
        className={clsx(
          "flex h-5 w-5 items-center justify-center rounded border-2",
          checked
            ? "border-violet-500 bg-violet-500"
            : "border-slate-600 bg-slate-900"
        )}
      >
        {checked && <Check size={12} className="text-white" />}
      </span>
    );
  }
  return (
    <span
      className={clsx(
        "flex h-5 w-5 items-center justify-center rounded-full border-2",
        checked ? "border-violet-500" : "border-slate-600"
      )}
    >
      {checked && <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />}
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
