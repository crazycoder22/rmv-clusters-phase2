import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

interface Member { residentId: string; role: "ORGANIZER" | "MEMBER"; name: string; block: number | null; flatNumber: string; googleImage: string | null }
interface PollSummary {
  id: string; title: string; playAt: string | null; closesAt: string | null;
  status: "OPEN" | "CLOSED"; isOpen: boolean; outcome: "GAME_ON" | "CANCELLED" | null;
  closeNote: string | null; voteCount: number; myVoted: boolean; createdAt: string;
}
interface GroupDetailData {
  id: string; name: string; description: string | null;
  myRole: "ORGANIZER" | "MEMBER" | null; canManage: boolean;
  members: Member[]; polls: PollSummary[];
}

// Token-styled modal input.
const inputCls = "one-input w-full rounded-[11px] px-3.5 py-3 text-[15px]";

export default function GroupDetail() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [data, setData] = useState<GroupDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/groups/${id}`, { token });
      if (!res.ok) { setError(res.status === 404 ? "Group not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally { setLoading(false); }
  }, [id, token]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  async function join() {
    setBusy(true);
    try { const r = await apiFetch(`/api/groups/${id}/join`, { method: "POST", token }); if (r.ok) await refresh(); }
    finally { setBusy(false); }
  }
  async function leave() {
    if (!confirm("Leave this group?")) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/api/groups/${id}/join`, { method: "DELETE", token });
      if (r.ok) await refresh(); else alert((await r.json().catch(() => null))?.error ?? "Could not leave");
    } finally { setBusy(false); }
  }

  if (loading) return <Centered><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="mb-3" style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p><button onClick={() => navigate("/groups")} className="text-sm" style={{ color: "var(--accent)" }}>← Groups</button></div></Centered>;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-6"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <button onClick={() => navigate("/groups")} className="flex items-center gap-1.5 py-3 text-[15px] font-semibold" style={{ color: "var(--text-2)" }}>
        <Icon name="arrow_back" size={20} style={{ color: "var(--text-2)" }} /> Groups
      </button>

      <div className="flex items-center gap-2.5">
        <Icon name="groups" size={24} style={{ color: "var(--carblue)" }} />
        <h1 className="flex-1 text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{data.name}</h1>
        <div className="shrink-0">
          {data.myRole ? (
            data.canManage ? (
              <button onClick={() => setMembersOpen(true)} className="inline-flex items-center gap-1.5 rounded-[11px] px-3.5 py-2 text-[13px] font-bold" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}>
                <Icon name="settings" size={16} style={{ color: "var(--text)" }} /> Manage
              </button>
            ) : (
              <button onClick={leave} disabled={busy} className="text-[14px] font-semibold" style={{ color: "var(--text-3)" }}>Leave</button>
            )
          ) : (
            <button onClick={join} disabled={busy} className="rounded-[11px] px-4 py-2 text-[14px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>{busy ? "Joining…" : "Join"}</button>
          )}
        </div>
      </div>
      {data.description && <p className="mt-1.5 text-[14px]" style={{ color: "var(--text-2)" }}>{data.description}</p>}
      <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>{data.members.length} member{data.members.length !== 1 ? "s" : ""}</p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {data.members.slice(0, 12).map((m) => (
          m.role === "ORGANIZER" ? (
            <span key={m.residentId} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--text)" }}>
              <Icon name="star" size={14} fill style={{ color: "var(--carblue)" }} />{m.name.split(" ")[0]}
            </span>
          ) : (
            <span key={m.residentId} className="rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>{m.name.split(" ")[0]}</span>
          )
        ))}
        {data.members.length > 12 && <span className="px-2 py-1.5 text-[13px]" style={{ color: "var(--text-3)" }}>+{data.members.length - 12}</span>}
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="one-mono text-[10px] font-medium uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>Polls</h2>
        {data.canManage && (
          <button onClick={() => setPollOpen(true)} className="inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-bold text-white active:opacity-90" style={{ background: "var(--accent-strong)" }}>
            <Icon name="add" size={16} style={{ color: "#fff" }} /> New poll
          </button>
        )}
      </div>

      {data.polls.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--text-3)" }}>No polls yet.</p>
      ) : (
        <div className="space-y-2.5">
          {data.polls.map((p) => (
            <Link key={p.id} to={`/groups/${id}/polls/${p.id}`} className="block rounded-[16px] p-[15px] active:opacity-90" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[17px] font-bold" style={{ color: "var(--text)" }}>{p.title}</h3>
                {p.isOpen ? (
                  <PollPill ms="schedule" tone="success">Open</PollPill>
                ) : p.outcome ? (
                  <PollPill tone={p.outcome === "GAME_ON" ? "success" : "danger"}>{p.outcome === "GAME_ON" ? "ON" : "Off"}</PollPill>
                ) : (
                  <PollPill ms="lock" tone="muted">Closed</PollPill>
                )}
              </div>
              {p.playAt && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--text-3)" }}>
                  <Icon name="calendar_today" size={15} style={{ color: "var(--text-3)" }} /> {fmtDateTime(p.playAt)}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-3 text-[13px]" style={{ color: "var(--text-3)" }}>
                <span>{p.voteCount} vote{p.voteCount !== 1 ? "s" : ""}</span>
                {p.isOpen && p.myVoted && <span className="inline-flex items-center gap-1" style={{ color: "var(--success)" }}><Icon name="check_circle" size={13} fill style={{ color: "var(--success)" }} /> Voted</span>}
                {p.isOpen && !p.myVoted && data.myRole && <span className="font-bold" style={{ color: "var(--accent)" }}>Vote now</span>}
              </div>
              {!p.isOpen && p.closeNote && <p className="mt-1 text-[13px] italic" style={{ color: "var(--text-3)" }}>“{p.closeNote}”</p>}
            </Link>
          ))}
        </div>
      )}

      {pollOpen && <NewPollModal token={token} groupId={id} onClose={() => setPollOpen(false)} onCreated={(pid) => { setPollOpen(false); navigate(`/groups/${id}/polls/${pid}`); }} />}
      {membersOpen && data && <ManageMembersModal token={token} group={data} onClose={() => setMembersOpen(false)} onChanged={refresh} onDeleted={() => navigate("/groups")} />}
    </div>
  );
}

function PollPill({ ms, tone, children }: { ms?: string; tone: "success" | "danger" | "muted"; children: React.ReactNode }) {
  const style = tone === "muted"
    ? { background: "var(--surface-3)", color: "var(--text-3)" }
    : { background: `var(--${tone}-soft)`, color: `var(--${tone})` };
  return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={style}>
      {ms && <Icon name={ms} size={13} style={{ color: style.color }} />}{children}
    </span>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3.5 pt-[max(2rem,env(safe-area-inset-top,0px))]" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="one-surface w-full max-w-md rounded-[22px] p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-[21px] font-extrabold" style={{ color: "var(--text)" }}>{title}</h3>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={24} style={{ color: "var(--text-3)" }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>{children}</label>;
}

function NewPollModal({ token, groupId, onClose, onCreated }: { token: string | null; groupId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [playAt, setPlayAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [options, setOptions] = useState<string[]>(["In", "Out", "Maybe"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!title.trim()) { setErr("Give the poll a title"); return; }
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (clean.length < 2) { setErr("Add at least 2 options"); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`/api/groups/${groupId}/polls`, {
        method: "POST", token,
        body: JSON.stringify({ title: title.trim(), playAt: playAt ? new Date(playAt).toISOString() : null, closesAt: closesAt ? new Date(closesAt).toISOString() : null, options: clean }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setErr(d?.error ?? "Could not create"); return; }
      onCreated(d.id);
    } finally { setBusy(false); }
  }

  return (
    <ModalShell title="New poll" onClose={onClose}>
      <div className="mt-4 space-y-3.5">
        <div><Label>Title</Label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Volleyball this Sunday 6pm?" className={inputCls} /></div>
        <div className="flex gap-3">
          <div className="flex-1"><Label>Play time (opt)</Label><input type="datetime-local" value={playAt} onChange={(e) => setPlayAt(e.target.value)} className={`${inputCls} min-w-0 appearance-none`} /></div>
          <div className="flex-1"><Label>Closes (opt)</Label><input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={`${inputCls} min-w-0 appearance-none`} /></div>
        </div>
        <div>
          <Label>Options</Label>
          <div className="space-y-2.5">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <input value={o} onChange={(e) => setOptions((p) => p.map((x, idx) => idx === i ? e.target.value : x))} className={inputCls} />
                {options.length > 2 && <button onClick={() => setOptions((p) => p.filter((_, idx) => idx !== i))} className="shrink-0" aria-label="Remove option"><Icon name="delete" size={20} style={{ color: "var(--text-3)" }} /></button>}
              </div>
            ))}
          </div>
          {options.length < 6 && <button onClick={() => setOptions((p) => [...p, ""])} className="mt-3 inline-flex items-center gap-1 text-[14px] font-bold" style={{ color: "var(--accent)" }}><Icon name="add" size={19} style={{ color: "var(--accent)" }} /> Add option</button>}
        </div>
        {err && <p className="rounded-[11px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}>{err}</p>}
        <button onClick={submit} disabled={busy} className="w-full rounded-[13px] py-3.5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>{busy ? "Posting…" : "Post & notify members"}</button>
      </div>
    </ModalShell>
  );
}

function ManageMembersModal({ token, group, onClose, onChanged, onDeleted }: { token: string | null; group: GroupDetailData; onClose: () => void; onChanged: () => void; onDeleted: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; block: number | null; flatNumber: string }[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 1) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      const res = await apiFetch(`/api/residents/search?q=${encodeURIComponent(term)}`, { token });
      if (res.ok) {
        const ids = new Set(group.members.map((m) => m.residentId));
        setHits(((await res.json()).residents ?? []).filter((r: { id: string }) => !ids.has(r.id)).slice(0, 10));
      }
    }, 250);
  }, [q, token, group.members]);

  async function add(residentId: string) { const r = await apiFetch(`/api/groups/${group.id}/members`, { method: "POST", token, body: JSON.stringify({ residentId }) }); if (r.ok) { setQ(""); setHits([]); onChanged(); } }
  async function setRole(residentId: string, role: "ORGANIZER" | "MEMBER") { const r = await apiFetch(`/api/groups/${group.id}/members/${residentId}`, { method: "PATCH", token, body: JSON.stringify({ role }) }); if (r.ok) onChanged(); else alert((await r.json().catch(() => null))?.error ?? "Could not update"); }
  async function remove(residentId: string) { const r = await apiFetch(`/api/groups/${group.id}/members/${residentId}`, { method: "DELETE", token }); if (r.ok) onChanged(); else alert((await r.json().catch(() => null))?.error ?? "Could not remove"); }
  async function deleteGroup() {
    if (!confirm(`Delete the "${group.name}" group? This removes all its polls and votes for everyone. This cannot be undone.`)) return;
    const r = await apiFetch(`/api/groups/${group.id}`, { method: "DELETE", token });
    if (r.ok) onDeleted();
    else alert((await r.json().catch(() => null))?.error ?? "Could not delete");
  }

  return (
    <ModalShell title="Manage members" onClose={onClose}>
      <div className="mt-4 flex items-center gap-2.5 rounded-[12px] px-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
        <Icon name="search" size={19} style={{ color: "var(--text-3)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a resident…" className="flex-1 bg-transparent py-3 text-[14px] outline-none" style={{ color: "var(--text)" }} />
      </div>
      {hits.length > 0 && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-[11px]" style={{ border: "1px solid var(--border)" }}>
          {hits.map((h) => (
            <button key={h.id} onClick={() => add(h.id)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[14px] active:opacity-80" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              <span style={{ color: "var(--text)" }}>{h.name}</span><span className="text-[12px]" style={{ color: "var(--text-3)" }}>B{h.block ?? "—"}, {h.flatNumber}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-1.5 max-h-72 overflow-y-auto">
        {group.members.map((m) => (
          <div key={m.residentId} className="flex items-center gap-2.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold" style={{ color: "var(--text)" }}>{m.name}</span>
                {m.role === "ORGANIZER" && <Icon name="star" size={14} fill style={{ color: "var(--carblue)" }} />}
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-3)" }}>B{m.block ?? "—"}, {m.flatNumber}</p>
            </div>
            {m.role === "MEMBER"
              ? <button onClick={() => setRole(m.residentId, "ORGANIZER")} className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>Promote</button>
              : <button onClick={() => setRole(m.residentId, "MEMBER")} className="text-[13px] font-bold" style={{ color: "var(--text-3)" }}>Demote</button>}
            <button onClick={() => remove(m.residentId)} aria-label="Remove"><Icon name="delete" size={19} style={{ color: "var(--text-3)" }} /></button>
          </div>
        ))}
      </div>
      <button onClick={deleteGroup} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[13px] py-3.5 text-[15px] font-bold active:opacity-80" style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}>
        <Icon name="delete" size={19} style={{ color: "var(--danger)" }} /> Delete group
      </button>
    </ModalShell>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="one-surface flex flex-1 items-center justify-center px-4" style={{ background: "var(--bg)", color: "var(--text)" }}>{children}</div>;
}
function fmtDateTime(iso: string): string { return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
