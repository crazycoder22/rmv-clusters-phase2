import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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

  if (loading) return <Centered><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="mb-3" style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p><button onClick={() => navigate(`/groups/${groupId}`)} className="text-sm" style={{ color: "var(--accent)" }}>← Group</button></div></Centered>;

  const totalVotes = data.options.reduce((s, o) => s + o.voteCount, 0);

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-6"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <button onClick={() => navigate(`/groups/${groupId}`)} className="flex items-center gap-1.5 py-3 text-[15px] font-semibold" style={{ color: "var(--text-2)" }}>
        <Icon name="arrow_back" size={20} style={{ color: "var(--text-2)" }} /> {data.groupName}
      </button>

      <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{data.title}</h1>
      <p className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>by {data.author}</p>
      {data.playAt && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[14px]" style={{ color: "var(--text)" }}>
          <Icon name="calendar_today" size={15} style={{ color: "var(--carblue)" }} /> {fmtDateTime(data.playAt)}
        </p>
      )}

      {data.isOpen ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-[11px] px-3.5 py-2.5 text-[14px] font-semibold" style={{ background: "var(--success-soft)", border: "1px solid var(--success-line)", color: "var(--success)" }}>
          <Icon name="schedule" size={15} style={{ color: "var(--success)" }} /> Voting open{data.closesAt ? ` until ${fmtDateTime(data.closesAt)}` : ""}
        </div>
      ) : (
        <div
          className="mt-3 rounded-[11px] px-3.5 py-2.5 text-[14px]"
          style={data.outcome === "GAME_ON"
            ? { background: "var(--success-soft)", border: "1px solid var(--success-line)", color: "var(--success)" }
            : data.outcome === "CANCELLED"
              ? { background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }
              : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        >
          <p className="font-bold">{data.outcome === "GAME_ON" ? "🟢 Game is ON" : data.outcome === "CANCELLED" ? "🔴 Cancelled" : "Voting closed"}</p>
          {data.closeNote && <p className="mt-0.5">{data.closeNote}</p>}
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        {data.options.map((o) => {
          const selected = data.myOptionId === o.id;
          const pct = totalVotes ? Math.round((o.voteCount / totalVotes) * 100) : 0;
          return (
            <button key={o.id} onClick={() => vote(o.id)} disabled={voting || !data.isOpen || !data.isMember}
              className="w-full rounded-[13px] p-3.5 text-left"
              style={selected
                ? { background: "var(--accent-soft)", border: "1px solid var(--accent)" }
                : { background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: "var(--text)" }}>
                  <Icon name={selected ? "check_circle" : "radio_button_unchecked"} size={18} fill={selected} style={{ color: selected ? "var(--accent)" : "var(--text-3)" }} />
                  {o.text}
                </span>
                <span className="text-[15px] font-bold" style={{ color: "var(--text-2)" }}>{o.voteCount}</span>
              </div>
              {o.voters.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                  {o.voters.map((vr) => <span key={vr.residentId} className="rounded-full px-2 py-0.5 text-[12px]" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>{vr.name.split(" ")[0]}</span>)}
                </div>
              )}
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: selected ? "var(--accent)" : "var(--accent-strong)", opacity: selected ? 1 : 0.5 }} />
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[13px]" style={{ color: "var(--text-3)" }}>{totalVotes} total vote{totalVotes !== 1 ? "s" : ""}{data.isOpen && data.isMember ? " · tap to vote (changeable)" : ""}{!data.isMember && data.isOpen ? " · join the group to vote" : ""}</p>

      {data.canManage && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {data.isOpen && (
            <>
              <button onClick={remind} className="inline-flex items-center gap-1.5 rounded-[11px] px-4 py-2.5 text-[14px] font-bold" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}><Icon name="notifications" size={15} style={{ color: "var(--text)" }} /> Reminder</button>
              <button onClick={() => setCloseOpen(true)} className="inline-flex items-center gap-1.5 rounded-[11px] px-4 py-2.5 text-[14px] font-bold text-white active:opacity-90" style={{ background: "var(--warning)" }}>Close poll</button>
            </>
          )}
          <button onClick={deletePoll} className="ml-auto inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "var(--text-3)" }}><Icon name="delete" size={15} style={{ color: "var(--text-3)" }} /> Delete</button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="one-surface w-full max-w-sm rounded-[22px] p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-[21px] font-extrabold" style={{ color: "var(--text)" }}>Close poll</h3>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={24} style={{ color: "var(--text-3)" }} /></button>
        </div>
        <p className="mb-3 mt-3 text-[14px]" style={{ color: "var(--text-2)" }}>All members get a notification with the outcome + note.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => setOutcome("GAME_ON")} className="rounded-[11px] py-3 text-[14px] font-bold"
            style={outcome === "GAME_ON" ? { background: "var(--success-soft)", border: "1px solid var(--success)", color: "var(--success)" } : { border: "1px solid var(--border-strong)", color: "var(--text-2)" }}>🟢 Game ON</button>
          <button onClick={() => setOutcome("CANCELLED")} className="rounded-[11px] py-3 text-[14px] font-bold"
            style={outcome === "CANCELLED" ? { background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)" } : { border: "1px solid var(--border-strong)", color: "var(--text-2)" }}>🔴 Cancelled</button>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note — 'Court 2, 6pm, 8 confirmed'" rows={3} className="one-input mt-3 w-full rounded-[11px] px-3.5 py-3 text-[15px]" />
        {err && <p className="mt-2 text-[13px]" style={{ color: "var(--danger)" }}>{err}</p>}
        <button onClick={submit} disabled={busy} className="mt-3 w-full rounded-[13px] py-3.5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>{busy ? "Closing…" : "Close & notify"}</button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="one-surface flex flex-1 items-center justify-center px-4" style={{ background: "var(--bg)", color: "var(--text)" }}>{children}</div>;
}
function fmtDateTime(iso: string): string { return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
