"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Vote, Lock, CheckCircle2, Users, Trophy, ShieldAlert,
  Trash2, Pencil, X,
} from "lucide-react";

interface Option {
  id: string;
  text: string;
  sortOrder: number;
  voteCount?: number; // present only when results are visible
}
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

export default function ReferendumDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [data, setData] = useState<ReferendumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/referendums/${id}`);
      if (!res.ok) { setError(res.status === 404 ? "Referendum not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  async function submitVote() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/referendums/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: selected }),
      });
      if (res.ok) {
        setConfirmOpen(false);
        await refresh();
      } else {
        alert((await res.json().catch(() => null))?.error ?? "Could not record your vote");
        setConfirmOpen(false);
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function closeNow() {
    if (!confirm("Close voting now? This is permanent — a referendum can never be reopened.")) return;
    const res = await fetch(`/api/referendums/${id}/close`, { method: "POST" });
    if (res.ok) await refresh();
    else alert((await res.json().catch(() => null))?.error ?? "Could not close");
  }

  async function deleteReferendum() {
    if (!data || !confirm(`Delete “${data.title}”?`)) return;
    const res = await fetch(`/api/referendums/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/referendums");
    else alert((await res.json().catch(() => null))?.error ?? "Could not delete");
  }

  if (loading) return <Centered><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="text-red-600 mb-3">{error ?? "Not found"}</p><Link href="/referendums" className="text-blue-600 text-sm">← All referendums</Link></div></Centered>;

  const canVote = data.isOpen && data.iAmEligible && !data.myFlatVoted;
  const selectedOption = data.options.find((o) => o.id === selected);
  const maxVotes = data.resultVisible ? Math.max(1, ...data.options.map((o) => o.voteCount ?? 0)) : 0;
  const winningCount = data.resultVisible ? Math.max(0, ...data.options.map((o) => o.voteCount ?? 0)) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between">
          <Link href="/referendums" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={16} /> All referendums</Link>
          {data.canManage && (
            <div className="flex items-center gap-3">
              {data.isOpen && data.turnout === 0 && (
                <Link href={`/referendums/${id}/edit`} className="text-gray-400 hover:text-blue-600"><Pencil size={18} /></Link>
              )}
              {data.isOpen && (
                <button type="button" onClick={closeNow} className="text-xs font-semibold text-amber-700 bg-amber-100 rounded-md px-3 py-1.5 hover:bg-amber-200">Close now</button>
              )}
              {data.turnout === 0 && (
                <button type="button" onClick={deleteReferendum} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
              )}
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mt-3 flex items-start gap-2">
          <Vote className="text-blue-600 mt-1 shrink-0" size={22} /> {data.title}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          by {data.author.name} · {data.eligibility === "OWNERS_ONLY" ? "Owners only" : "All residents"}
        </p>

        {data.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.imageUrl} alt="" className="mt-3 w-full rounded-lg border border-gray-200 object-cover" />
        )}

        <p className="mt-3 text-gray-800 whitespace-pre-wrap leading-relaxed">{data.body}</p>

        {/* Status banner */}
        {data.isOpen ? (
          <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Voting is open until {fmtDateTime(data.closesAt)}. Results are hidden until it closes.
          </div>
        ) : (
          <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
            <Lock size={14} /> Voting closed{data.closedAt ? ` on ${fmtDateTime(data.closedAt)}` : ""}.
          </div>
        )}

        {/* Turnout */}
        <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-500">
          <Users size={14} /> {data.turnout} of {data.eligibleFlats} eligible flats voted
          {data.eligibleFlats > 0 && ` · ${Math.round((data.turnout / data.eligibleFlats) * 100)}%`}
        </div>

        {/* ── State 1: can vote ── */}
        {canVote && (
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Cast your flat&apos;s vote</h2>
            <div className="space-y-2">
              {data.options.map((o) => (
                <label
                  key={o.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selected === o.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <input
                    type="radio"
                    name="option"
                    checked={selected === o.id}
                    onChange={() => setSelected(o.id)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-800">{o.text}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Your vote is secret and final — it can&apos;t be changed once submitted.</p>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!selected}
              className="w-full mt-3 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Vote
            </button>
          </div>
        )}

        {/* ── State 2: voted / ineligible (open, no results) ── */}
        {data.isOpen && !canVote && (
          <div className="mt-6">
            {data.myFlatVoted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 inline-flex items-center gap-2 text-green-800">
                <CheckCircle2 size={18} /> Your flat has voted. Results will be shown after voting closes.
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 inline-flex items-center gap-2 text-amber-800">
                <ShieldAlert size={18} /> This referendum is for owners only — your flat isn&apos;t eligible to vote.
              </div>
            )}
          </div>
        )}

        {/* ── State 3: closed — results ── */}
        {data.resultVisible && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Result</h2>
            {data.turnout === 0 ? (
              <p className="text-sm text-gray-400">No votes were cast.</p>
            ) : (
              <div className="space-y-3">
                {[...data.options]
                  .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
                  .map((o) => {
                    const count = o.voteCount ?? 0;
                    const pct = data.totalVotes ? Math.round((count / data.totalVotes) * 100) : 0;
                    const isWinner = count === winningCount && count > 0;
                    return (
                      <div key={o.id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className={`flex items-center gap-1 ${isWinner ? "font-bold text-gray-900" : "text-gray-700"}`}>
                            {isWinner && <Trophy size={14} className="text-amber-500" />} {o.text}
                          </span>
                          <span className="text-gray-500">{count} · {pct}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isWinner ? "bg-blue-600" : "bg-blue-300"}`}
                            style={{ width: `${maxVotes ? (count / maxVotes) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                <p className="text-xs text-gray-400 pt-1">{data.totalVotes} total votes · secret ballot</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Double-confirm modal */}
      {confirmOpen && selectedOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-gray-900">Confirm your vote</h3>
              <button type="button" onClick={() => setConfirmOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-700 mt-3">
              You are voting for:
            </p>
            <p className="text-base font-bold text-gray-900 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-1">
              {selectedOption.text}
            </p>
            <p className="text-sm text-red-600 mt-3 font-medium">
              This is final. Your flat gets only one vote and it cannot be changed or withdrawn.
            </p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">Go back</button>
              <button type="button" onClick={submitVote} disabled={submitting} className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center">{children}</div>;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
