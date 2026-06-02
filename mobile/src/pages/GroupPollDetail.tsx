import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, Bell, Trash2, X, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

interface Voter { residentId: string; name: string; block: number | null; flatNumber: string }
interface Option { id: string; text: string; voteCount: number; voters: Voter[] }
interface PollDetail {
  id: string; groupId: string; groupName: string; title: string; author: string;
  playAt: string | null; closesAt: string | null; status: "OPEN" | "CLOSED"; isOpen: boolean;
  outcome: "GAME_ON" | "CANCELLED" | null; closeNote: string | null;
  isMember: boolean; canManage: boolean; myOptionId: string | null; options: Option[];
}

export default function GroupPollDetail() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id: groupId = "", pollId = "" } = useParams();
  const [data, setData] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    try {
      const res = await apiFetch(`/api/groups/${groupId}/polls/${pollId}`, { token });
      if (!res.ok) { if (!silent) setError(res.status === 404 ? "Poll not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally { if (!silent) setLoading(false); }
  }, [groupId, pollId, token]);

  useEffect(() => {
    if (!pollId) return;
    void refresh();
    const interval = setInterval(() => void refresh(true), 5000);
    return () => clearInterval(interval);
  }, [pollId, refresh]);

  async function vote(optionId: string) {
    if (!data?.isOpen || !data.isMember) return;
    setVoting(true);
    setData((d) => d ? { ...d, myOptionId: optionId } : d);
    try {
      const res = await apiFetch(`/api/groups/${groupId}/polls/${pollId}/vote`, { method: "POST", token, body: JSON.stringify({ optionId }) });
      if (res.ok) await refresh(true); else { alert((await res.json().catch(() => null))?.error ?? "Could not vote"); await refresh(true); }
    } finally { setVoting(false); }
  }

  async function remind() {
    const res = await apiFetch(`/api/groups/${groupId}/polls/${pollId}/remind`, { method: "POST", token });
    if (res.ok) { const d = await res.json(); alert(d.reminded === 0 ? "Everyone has already voted 🎉" : `Reminder sent to ${d.reminded} member(s).`); }
    else alert((await res.json().catch(() => null))?.error ?? "Could not send");
  }

  async function deletePoll() {
    if (!confirm("Delete this poll?")) return;
    const res = await apiFetch(`/api/groups/${groupId}/polls/${pollId}`, { method: "DELETE", token });
    if (res.ok) navigate(`/groups/${groupId}`);
  }

  if (loading) return <Centered><Loader2 size={22} className="animate-spin text-slate-500" /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="mb-3 text-red-400">{error ?? "Not found"}</p><button onClick={() => navigate(`/groups/${groupId}`)} className="text-sm text-blue-400">← Group</button></div></Centered>;

  const totalVotes = data.options.reduce((s, o) => s + o.voteCount, 0);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
      <button onClick={() => navigate(`/groups/${groupId}`)} className="flex items-center gap-1 py-4 text-sm text-slate-400"><ArrowLeft size={16} /> {data.groupName}</button>

      <h1 className="text-xl font-bold text-white">{data.title}</h1>
      <p className="mt-1 text-[11px] text-slate-500">by {data.author}</p>
      {data.playAt && <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-300"><Calendar size={14} className="text-blue-400" /> {fmtDateTime(data.playAt)}</p>}

      {data.isOpen ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"><Clock size={14} /> Voting open{data.closesAt ? ` until ${fmtDateTime(data.closesAt)}` : ""}</div>
      ) : (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${data.outcome === "GAME_ON" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : data.outcome === "CANCELLED" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-slate-700 bg-slate-800/60 text-slate-300"}`}>
          <p className="font-semibold">{data.outcome === "GAME_ON" ? "🟢 Game is ON" : data.outcome === "CANCELLED" ? "🔴 Cancelled" : "Voting closed"}</p>
          {data.closeNote && <p className="mt-0.5">{data.closeNote}</p>}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {data.options.map((o) => {
          const selected = data.myOptionId === o.id;
          const pct = totalVotes ? Math.round((o.voteCount / totalVotes) * 100) : 0;
          return (
            <button key={o.id} onClick={() => vote(o.id)} disabled={voting || !data.isOpen || !data.isMember}
              className={`w-full rounded-lg border p-3 text-left ${selected ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-800/60"}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  {selected ? <CheckCircle2 size={18} className="text-blue-400" /> : <Circle size={18} className="text-slate-600" />}
                  {o.text}
                </span>
                <span className="text-sm font-semibold text-slate-300">{o.voteCount}</span>
              </div>
              {o.voters.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 pl-7">
                  {o.voters.map((vr) => <span key={vr.residentId} className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-300">{vr.name.split(" ")[0]}</span>)}
                </div>
              )}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${selected ? "bg-blue-500" : "bg-blue-400/50"}`} style={{ width: `${pct}%` }} /></div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">{totalVotes} total vote{totalVotes !== 1 ? "s" : ""}{data.isOpen && data.isMember ? " · tap to vote (changeable)" : ""}{!data.isMember && data.isOpen ? " · join the group to vote" : ""}</p>

      {data.canManage && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {data.isOpen && (
            <>
              <button onClick={remind} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 active:bg-slate-800"><Bell size={15} /> Reminder</button>
              <button onClick={() => setCloseOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white active:bg-amber-600">Close poll</button>
            </>
          )}
          <button onClick={deletePoll} className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-500"><Trash2 size={15} /> Delete</button>
        </div>
      )}

      {closeOpen && <CloseModal token={token} groupId={groupId} pollId={pollId} onClose={() => setCloseOpen(false)} onDone={async () => { setCloseOpen(false); await refresh(); }} />}
    </div>
  );
}

function CloseModal({ token, groupId, pollId, onClose, onDone }: { token: string | null; groupId: string; pollId: string; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState<"GAME_ON" | "CANCELLED" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!outcome) { setErr("Pick an outcome"); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`/api/groups/${groupId}/polls/${pollId}/close`, { method: "POST", token, body: JSON.stringify({ outcome, note: note.trim() || null }) });
      if (res.ok) onDone(); else setErr((await res.json().catch(() => null))?.error ?? "Could not close");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-white">Close poll</h3><button onClick={onClose} className="text-slate-400"><X size={18} /></button></div>
        <p className="mb-3 text-sm text-slate-300">All members get a notification with the outcome + note.</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setOutcome("GAME_ON")} className={`rounded-lg border py-3 text-sm font-semibold ${outcome === "GAME_ON" ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-slate-700 text-slate-300"}`}>🟢 Game ON</button>
          <button onClick={() => setOutcome("CANCELLED")} className={`rounded-lg border py-3 text-sm font-semibold ${outcome === "CANCELLED" ? "border-red-500 bg-red-500/10 text-red-300" : "border-slate-700 text-slate-300"}`}>🔴 Cancelled</button>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note — 'Court 2, 6pm, 8 confirmed'" rows={3} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none" />
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        <button onClick={submit} disabled={busy} className="mt-3 w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white active:bg-indigo-600 disabled:opacity-50">{busy ? "Closing…" : "Close & notify"}</button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) { return <div className="flex flex-1 items-center justify-center px-4">{children}</div>; }
function fmtDateTime(iso: string): string { return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
