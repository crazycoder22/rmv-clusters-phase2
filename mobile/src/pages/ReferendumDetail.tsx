import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Vote, Lock, CheckCircle2, Users, Trophy, ShieldAlert, Trash2, Pencil, X,
  ChevronDown, ChevronUp, Clock,
} from "lucide-react";

interface Roster {
  voted: { name: string; block: number | null; flatNumber: string; votedAt: string }[];
  pending: { block: number | null; flatNumber: string; residents: string[] }[];
  votedCount: number;
  pendingCount: number;
}
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

interface Option { id: string; text: string; sortOrder: number; voteCount?: number }
interface ReferendumDetail {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  eligibility: "OWNERS_ONLY" | "ALL_RESIDENTS";
  status: "OPEN" | "CLOSED";
  closesAt: string;
  closedAt: string | null;
  isOpen: boolean;
  resultVisible: boolean;
  iAmEligible: boolean;
  myFlatVoted: boolean;
  turnout: number;
  eligibleFlats: number;
  totalVotes?: number;
  author: { id: string; name: string; block: number | null; flatNumber: string };
  canManage: boolean;
  options: Option[];
}

export default function ReferendumDetail() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [data, setData] = useState<ReferendumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);

  async function toggleRoster() {
    if (rosterOpen) { setRosterOpen(false); return; }
    setRosterOpen(true);
    if (roster) return;
    setRosterLoading(true);
    try {
      const res = await apiFetch(`/api/referendums/${id}/voters`, { token });
      if (res.ok) setRoster(await res.json());
    } finally {
      setRosterLoading(false);
    }
  }

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/referendums/${id}`, { token });
      if (!res.ok) { setError(res.status === 404 ? "Referendum not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  async function submitVote() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/referendums/${id}/vote`, {
        method: "POST", token, body: JSON.stringify({ optionId: selected }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        alert(e?.error ?? "Could not record your vote");
      }
      setConfirmOpen(false);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function closeNow() {
    if (!confirm("Close voting now? This is permanent — a referendum can never be reopened.")) return;
    const res = await apiFetch(`/api/referendums/${id}/close`, { method: "POST", token });
    if (res.ok) await refresh();
  }

  async function deleteReferendum() {
    if (!data || !confirm(`Delete "${data.title}"?`)) return;
    const res = await apiFetch(`/api/referendums/${id}`, { method: "DELETE", token });
    if (res.ok) navigate("/referendums");
  }

  if (loading) return <Centered><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-400" /></Centered>;
  if (error || !data) return (
    <Centered>
      <div className="text-center">
        <p className="mb-3 text-red-400">{error ?? "Not found"}</p>
        <button onClick={() => navigate("/referendums")} className="text-sm text-blue-400">← All referendums</button>
      </div>
    </Centered>
  );

  const canVote = data.isOpen && data.iAmEligible && !data.myFlatVoted;
  const selectedOption = data.options.find((o) => o.id === selected);
  const maxVotes = data.resultVisible ? Math.max(1, ...data.options.map((o) => o.voteCount ?? 0)) : 0;
  const winningCount = data.resultVisible ? Math.max(0, ...data.options.map((o) => o.voteCount ?? 0)) : 0;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
      <div className="flex items-center justify-between py-4">
        <button onClick={() => navigate("/referendums")} className="flex items-center gap-1 text-sm text-slate-400">
          <ArrowLeft size={16} /> All referendums
        </button>
        {data.canManage && (
          <div className="flex items-center gap-3">
            {data.isOpen && data.turnout === 0 && (
              <button onClick={() => navigate(`/referendums/${id}/edit`)} className="text-slate-400"><Pencil size={18} /></button>
            )}
            {data.isOpen && (
              <button onClick={closeNow} className="rounded-md bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-200">Close now</button>
            )}
            {data.turnout === 0 && (
              <button onClick={deleteReferendum} className="text-slate-400"><Trash2 size={18} /></button>
            )}
          </div>
        )}
      </div>

      <h1 className="flex items-start gap-2 text-xl font-bold text-white"><Vote className="mt-1 shrink-0 text-blue-400" size={20} /> {data.title}</h1>
      <p className="mt-1 text-[11px] text-slate-500">by {data.author.name} · {data.eligibility === "OWNERS_ONLY" ? "Owners only" : "All residents"}</p>

      {data.imageUrl && <img src={data.imageUrl} alt="" className="mt-3 w-full rounded-lg border border-slate-700 object-cover" />}

      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-200">{data.body}</p>

      {data.isOpen ? (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300">
          Voting open until {fmtDateTime(data.closesAt)}. Results hidden until it closes.
        </div>
      ) : (
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-[12px] text-slate-400">
          <Lock size={13} /> Voting closed{data.closedAt ? ` on ${fmtDateTime(data.closedAt)}` : ""}.
        </div>
      )}

      <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-slate-500">
        <Users size={13} /> {data.turnout} of {data.eligibleFlats} eligible flats voted
        {data.eligibleFlats > 0 && ` · ${Math.round((data.turnout / data.eligibleFlats) * 100)}%`}
      </div>

      {/* Committee-only voter roster (who has voted — never the choice) */}
      {data.canManage && (
        <div className="mt-3">
          <button
            type="button"
            onClick={toggleRoster}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-400"
          >
            <Users size={14} /> Who has voted
            {rosterOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {rosterOpen && (
            <div className="mt-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
              <p className="mb-3 text-[10px] text-slate-500">
                Committee view. Shows which flats have voted — never how they voted.
              </p>
              {rosterLoading || !roster ? (
                <div className="flex justify-center py-3"><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-400" /></div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Voted ({roster.votedCount})</h4>
                    {roster.voted.length === 0 ? (
                      <p className="text-[12px] text-slate-500">No one yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {roster.voted.map((v, i) => (
                          <li key={i} className="flex items-center justify-between text-[12px]">
                            <span className="text-slate-200"><CheckCircle2 size={11} className="mr-1 inline text-emerald-400" />{v.name}</span>
                            <span className="text-[10px] text-slate-500">B{v.block ?? "—"}, {v.flatNumber}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300">Not yet voted ({roster.pendingCount})</h4>
                    {roster.pending.length === 0 ? (
                      <p className="text-[12px] text-slate-500">Every eligible flat has voted. 🎉</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {roster.pending.map((p, i) => (
                          <li key={i} className="flex items-center justify-between text-[12px]">
                            <span className="text-slate-400"><Clock size={11} className="mr-1 inline text-amber-400" />{p.residents.join(", ")}</span>
                            <span className="text-[10px] text-slate-500">B{p.block ?? "—"}, {p.flatNumber}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* State 1: can vote */}
      {canVote && (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
          <h2 className="mb-3 font-semibold text-white">Cast your flat&apos;s vote</h2>
          <div className="space-y-2">
            {data.options.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selected === o.id ? "border-blue-500 bg-blue-500/10" : "border-slate-700"}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected === o.id ? "border-blue-400" : "border-slate-500"}`}>
                  {selected === o.id && <span className="h-2 w-2 rounded-full bg-blue-400" />}
                </span>
                <span className="text-sm text-slate-200">{o.text}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Your vote is secret and final — it can&apos;t be changed once submitted.</p>
          <button onClick={() => setConfirmOpen(true)} disabled={!selected} className="mt-3 w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white active:bg-indigo-600 disabled:opacity-50">
            Vote
          </button>
        </div>
      )}

      {/* State 2: voted / ineligible */}
      {data.isOpen && !canVote && (
        <div className="mt-6">
          {data.myFlatVoted ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
              <CheckCircle2 size={18} /> Your flat has voted. Results show after voting closes.
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
              <ShieldAlert size={18} /> This referendum is for owners only — your flat isn&apos;t eligible.
            </div>
          )}
        </div>
      )}

      {/* State 3: results */}
      {data.resultVisible && (
        <div className="mt-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Result</h2>
          {data.turnout === 0 ? (
            <p className="text-sm text-slate-500">No votes were cast.</p>
          ) : (
            <div className="space-y-3">
              {[...data.options].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0)).map((o) => {
                const count = o.voteCount ?? 0;
                const pct = data.totalVotes ? Math.round((count / data.totalVotes) * 100) : 0;
                const isWinner = count === winningCount && count > 0;
                return (
                  <div key={o.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className={`flex items-center gap-1 ${isWinner ? "font-bold text-white" : "text-slate-300"}`}>
                        {isWinner && <Trophy size={13} className="text-amber-400" />} {o.text}
                      </span>
                      <span className="text-slate-500">{count} · {pct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${isWinner ? "bg-blue-500" : "bg-blue-400/50"}`} style={{ width: `${maxVotes ? (count / maxVotes) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] text-slate-500">{data.totalVotes} total votes · secret ballot</p>
            </div>
          )}
        </div>
      )}

      {/* Double-confirm modal */}
      {confirmOpen && selectedOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-white">Confirm your vote</h3>
              <button onClick={() => setConfirmOpen(false)} className="text-slate-400"><X size={18} /></button>
            </div>
            <p className="mt-3 text-sm text-slate-300">You are voting for:</p>
            <p className="mt-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-base font-bold text-white">{selectedOption.text}</p>
            <p className="mt-3 text-sm font-medium text-red-300">This is final. Your flat gets only one vote and it cannot be changed or withdrawn.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-200">Go back</button>
              <button onClick={submitVote} disabled={submitting} className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white active:bg-indigo-600 disabled:opacity-50">
                {submitting ? "Submitting…" : "Confirm & submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center px-4">{children}</div>;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
