import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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
      if (poll.type === "SINGLE") return new Set([optId]);
      const next = new Set(prev);
      if (next.has(optId)) next.delete(optId);
      else next.add(optId);
      return next;
    });
  };

  const submit = async () => {
    if (!poll || picked.size === 0) {
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

  const expired = poll?.status === "CLOSED" || (!!poll && new Date(poll.deadline).getTime() < Date.now());
  const hasVoted = myVotes.length > 0;
  const canVote = !!poll && !expired && !hasVoted;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-2.5">
        <Link to="/polls" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Poll</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
      ) : !poll ? (
        <p className="py-10 text-center text-[14px]" style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p>
      ) : (
        <>
          {/* Question card */}
          <div className="rounded-[18px] p-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
            <div className="flex flex-wrap items-center gap-2">
              {expired ? (
                <Pill text="Closed" bg="var(--surface-3)" fg="var(--text-3)" />
              ) : (
                <Pill text="Active" bg="var(--accent-strong)" fg="#fff" />
              )}
              <Pill text={poll.type === "MULTIPLE" ? "Pick multiple" : "Pick one"} bg="var(--accent-soft)" fg="var(--accent)" />
              {poll.isAnonymous && <Pill text="Anonymous" bg="var(--surface-3)" fg="var(--text-2)" />}
            </div>
            <h2 className="mt-3 text-[23px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>{poll.title}</h2>
            {poll.description && (
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>{poll.description}</p>
            )}
            <p className="mt-3 text-[13px]" style={{ color: "var(--text-3)" }}>
              {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"} · {expired ? "Ended" : "Ends"} {formatDate(poll.deadline)} · by {poll.createdBy.name}
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-[10px] px-3 py-2 text-center text-[12px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</p>
          )}

          {canVote ? (
            <>
              {/* Vote UI */}
              <div className="mt-4 flex flex-col gap-3">
                {poll.options.map((opt) => {
                  const on = picked.has(opt.id);
                  const box =
                    poll.type === "MULTIPLE"
                      ? on ? "check_box" : "check_box_outline_blank"
                      : on ? "radio_button_checked" : "radio_button_unchecked";
                  return (
                    <button
                      key={opt.id}
                      onClick={() => togglePick(opt.id)}
                      className="flex items-center gap-3 rounded-[14px] px-4 py-[17px] text-left transition-colors"
                      style={{
                        background: on ? "var(--accent-soft)" : "var(--surface)",
                        border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                      }}
                    >
                      <Icon name={box} size={24} fill={on} className="flex-shrink-0" style={{ color: on ? "var(--accent)" : "var(--text-3)" }} />
                      <span className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={submit}
                disabled={submitting || picked.size === 0}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] py-4 text-[16px] font-bold text-white"
                style={{ background: "var(--accent-strong)", opacity: submitting || picked.size === 0 ? 0.55 : 1, boxShadow: "0 8px 22px var(--accent-soft)" }}
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Icon name="send" size={20} style={{ color: "#fff" }} />}
                {submitting ? "Voting…" : "Submit vote"}
              </button>
            </>
          ) : (
            <>
              {/* Results UI */}
              <Results poll={poll} myVotes={myVotes} />
              <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: expired ? "var(--text-3)" : "var(--success)" }}>
                <Icon name={expired ? "lock" : "check_circle"} size={16} fill={!expired} style={{ color: expired ? "var(--text-3)" : "var(--success)" }} />
                {expired ? "This poll has ended." : "Thanks — your vote was recorded."}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Results({ poll, myVotes }: { poll: Poll; myVotes: string[] }) {
  const sum = poll.options.reduce((a, o) => a + o.voteCount, 0);
  const maxC = Math.max(0, ...poll.options.map((o) => o.voteCount));
  return (
    <div className="mt-4 flex flex-col gap-3">
      {poll.options.map((opt) => {
        const pct = sum > 0 ? Math.round((opt.voteCount / sum) * 100) : 0;
        const win = opt.voteCount === maxC && opt.voteCount > 0;
        const youVoted = myVotes.includes(opt.id);
        const voters = opt.voters.filter((v): v is NonNullable<Voter> => !!v);
        return (
          <div
            key={opt.id}
            className="rounded-[14px] px-[15px] py-[13px]"
            style={{ background: "var(--surface)", border: `1px solid ${win ? "color-mix(in srgb, var(--accent) 40%, var(--border))" : "var(--border)"}` }}
          >
            <div className="flex items-center justify-between gap-2.5">
              <span className="flex items-center gap-2 text-[15px] font-bold" style={{ color: "var(--text)" }}>
                {opt.text}
                {youVoted && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Your vote</span>
                )}
              </span>
              <span className="text-[14px] font-bold" style={{ color: win ? "var(--accent)" : "var(--text-2)" }}>{pct}%</span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: win ? "var(--accent)" : "var(--text-3)" }} />
            </div>
            <div className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-3)" }}>{opt.voteCount} votes</div>
            {!poll.isAnonymous && voters.length > 0 && (
              <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-3)" }}>
                {voters.map((v) => `${v.name} (B${v.block}-${v.flatNumber})`).join(", ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span className="flex-shrink-0 rounded-full px-3 py-[5px] text-[12px] font-bold" style={{ background: bg, color: fg }}>
      {text}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
