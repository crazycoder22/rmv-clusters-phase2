"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Calendar, Clock, Bell, Trash2, X, CheckCircle2, Circle,
} from "lucide-react";

interface Voter { residentId: string; name: string; block: number | null; flatNumber: string }
interface Option { id: string; text: string; voteCount: number; voters: Voter[] }
interface PollDetail {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  author: string;
  playAt: string | null;
  closesAt: string | null;
  status: "OPEN" | "CLOSED";
  isOpen: boolean;
  outcome: "GAME_ON" | "CANCELLED" | null;
  closeNote: string | null;
  isMember: boolean;
  canManage: boolean;
  myOptionId: string | null;
  options: Option[];
}

export default function GroupPollDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string; pollId: string }>();
  const groupId = params?.id ?? "";
  const pollId = params?.pollId ?? "";

  const [data, setData] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/polls/${pollId}`);
      if (!res.ok) { if (!silent) setError(res.status === 404 ? "Poll not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [groupId, pollId]);

  // initial + poll every 5s while open
  useEffect(() => {
    if (!pollId) return;
    void refresh();
    const interval = setInterval(() => void refresh(true), 5000);
    return () => clearInterval(interval);
  }, [pollId, refresh]);

  async function vote(optionId: string) {
    if (!data?.isOpen || !data.isMember) return;
    setVoting(true);
    // optimistic
    setData((d) => d ? { ...d, myOptionId: optionId } : d);
    try {
      const res = await fetch(`/api/groups/${groupId}/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (res.ok) await refresh(true);
      else { alert((await res.json().catch(() => null))?.error ?? "Could not vote"); await refresh(true); }
    } finally {
      setVoting(false);
    }
  }

  async function remind() {
    const res = await fetch(`/api/groups/${groupId}/polls/${pollId}/remind`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      alert(d.reminded === 0 ? "Everyone has already voted 🎉" : `Reminder sent to ${d.reminded} member(s).`);
    } else alert((await res.json().catch(() => null))?.error ?? "Could not send reminder");
  }

  async function deletePoll() {
    if (!confirm("Delete this poll?")) return;
    const res = await fetch(`/api/groups/${groupId}/polls/${pollId}`, { method: "DELETE" });
    if (res.ok) router.push(`/groups/${groupId}`);
  }

  if (loading) return <Centered><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="text-red-600 mb-3">{error ?? "Not found"}</p><Link href={`/groups/${groupId}`} className="text-blue-600 text-sm">← Group</Link></div></Centered>;

  const totalVotes = data.options.reduce((s, o) => s + o.voteCount, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href={`/groups/${groupId}`} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> {data.groupName}</Link>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3">{data.title}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">by {data.author}</p>
        {data.playAt && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 inline-flex items-center gap-1.5"><Calendar size={14} className="text-blue-600" /> {fmtDateTime(data.playAt)}</p>}

        {/* Status banner */}
        {data.isOpen ? (
          <div className="mt-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
            <Clock size={14} /> Voting open{data.closesAt ? ` until ${fmtDateTime(data.closesAt)}` : ""}
          </div>
        ) : (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm border ${data.outcome === "GAME_ON" ? "bg-green-50 dark:bg-green-900/30 border-green-200 text-green-800 dark:text-green-300" : data.outcome === "CANCELLED" ? "bg-red-50 dark:bg-red-900/30 border-red-200 text-red-800 dark:text-red-300" : "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"}`}>
            <p className="font-semibold">{data.outcome === "GAME_ON" ? "🟢 Game is ON" : data.outcome === "CANCELLED" ? "🔴 Cancelled" : "Voting closed"}</p>
            {data.closeNote && <p className="mt-0.5">{data.closeNote}</p>}
          </div>
        )}

        {/* Options */}
        <div className="mt-6 space-y-2">
          {data.options.map((o) => {
            const selected = data.myOptionId === o.id;
            const pct = totalVotes ? Math.round((o.voteCount / totalVotes) * 100) : 0;
            return (
              <div key={o.id}>
                <button
                  type="button"
                  onClick={() => vote(o.id)}
                  disabled={voting || !data.isOpen || !data.isMember}
                  className={`w-full text-left rounded-lg border p-3 transition ${selected ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"} ${data.isOpen && data.isMember ? "hover:border-blue-400 cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selected ? <CheckCircle2 size={18} className="text-blue-600" /> : <Circle size={18} className="text-gray-300 dark:text-gray-600" />}
                      {o.text}
                    </span>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{o.voteCount}</span>
                  </div>
                  {/* voter chips (public) */}
                  {o.voters.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pl-7">
                      {o.voters.map((vr) => (
                        <span key={vr.residentId} className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-1.5 py-0.5">{vr.name.split(" ")[0]}</span>
                      ))}
                    </div>
                  )}
                  {/* bar */}
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
                    <div className={`h-full rounded-full ${selected ? "bg-blue-600" : "bg-blue-300"}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{totalVotes} total vote{totalVotes !== 1 ? "s" : ""}{data.isOpen && data.isMember ? " · tap an option to vote (you can change it)" : ""}{!data.isMember && data.isOpen ? " · join the group to vote" : ""}</p>

        {/* Organizer bar */}
        {data.canManage && (
          <div className="mt-6 flex items-center gap-2 flex-wrap">
            {data.isOpen && (
              <>
                <button type="button" onClick={remind} className="inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"><Bell size={15} /> Send reminder</button>
                <button type="button" onClick={() => setCloseOpen(true)} className="inline-flex items-center gap-1.5 bg-amber-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-600">Close poll</button>
              </>
            )}
            <button type="button" onClick={deletePoll} className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-red-600 ml-auto"><Trash2 size={15} /> Delete</button>
          </div>
        )}
      </div>

      {closeOpen && <CloseModal groupId={groupId} pollId={pollId} onClose={() => setCloseOpen(false)} onDone={async () => { setCloseOpen(false); await refresh(); }} />}
    </div>
  );
}

function CloseModal({ groupId, pollId, onClose, onDone }: { groupId: string; pollId: string; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState<"GAME_ON" | "CANCELLED" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!outcome) { setErr("Pick an outcome"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/polls/${pollId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, note: note.trim() || null }),
      });
      if (res.ok) onDone();
      else setErr((await res.json().catch(() => null))?.error ?? "Could not close");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Close poll</h3>
          <button type="button" onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">All members get a notification with the outcome + note.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOutcome("GAME_ON")} className={`rounded-lg border py-3 text-sm font-semibold ${outcome === "GAME_ON" ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"}`}>🟢 Game ON</button>
          <button type="button" onClick={() => setOutcome("CANCELLED")} className={`rounded-lg border py-3 text-sm font-semibold ${outcome === "CANCELLED" ? "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"}`}>🔴 Cancelled</button>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note — e.g. 'Court 2 at 6pm, 8 confirmed, bring water'" rows={3} className="w-full mt-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
        <button type="button" onClick={submit} disabled={busy} className="w-full mt-3 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">{busy ? "Closing…" : "Close & notify members"}</button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">{children}</div>;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
