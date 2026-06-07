import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Users, Plus, Settings, X, Search, Trash2, Clock, Lock, CheckCircle2, Calendar, Loader2,
} from "lucide-react";
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

  if (loading) return <Centered><Loader2 size={22} className="animate-spin text-slate-500" /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="mb-3 text-red-400">{error ?? "Not found"}</p><button onClick={() => navigate("/groups")} className="text-sm text-blue-400">← Groups</button></div></Centered>;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
      <button onClick={() => navigate("/groups")} className="flex items-center gap-1 py-4 text-sm text-slate-400"><ArrowLeft size={16} /> Groups</button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white"><Users className="text-blue-400" size={20} /> {data.name}</h1>
          {data.description && <p className="mt-1 text-sm text-slate-400">{data.description}</p>}
          <p className="mt-1 text-[11px] text-slate-500">{data.members.length} member{data.members.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="shrink-0">
          {data.myRole ? (
            data.canManage ? (
              <button onClick={() => setMembersOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 active:bg-slate-800"><Settings size={14} /> Manage</button>
            ) : (
              <button onClick={leave} disabled={busy} className="text-sm text-slate-400">Leave</button>
            )
          ) : (
            <button onClick={join} disabled={busy} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white active:bg-indigo-600 disabled:opacity-50">{busy ? "Joining…" : "Join"}</button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {data.members.slice(0, 12).map((m) => (
          <span key={m.residentId} className={`rounded-full px-2 py-1 text-[11px] ${m.role === "ORGANIZER" ? "bg-blue-500/20 text-blue-300" : "bg-slate-700 text-slate-300"}`}>{m.role === "ORGANIZER" && "★ "}{m.name.split(" ")[0]}</span>
        ))}
        {data.members.length > 12 && <span className="px-2 py-1 text-[11px] text-slate-500">+{data.members.length - 12}</span>}
      </div>

      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Polls</h2>
        {data.canManage && <button onClick={() => setPollOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white active:bg-indigo-600"><Plus size={15} /> New poll</button>}
      </div>

      {data.polls.length === 0 ? (
        <p className="text-sm text-slate-500">No polls yet.</p>
      ) : (
        <div className="space-y-2">
          {data.polls.map((p) => (
            <Link key={p.id} to={`/groups/${id}/polls/${p.id}`} className="block rounded-2xl border border-slate-700 bg-slate-800/60 p-3 active:bg-slate-800">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{p.title}</h3>
                {p.isOpen ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300"><Clock size={10} /> Open</span>
                ) : p.outcome ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.outcome === "GAME_ON" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>{p.outcome === "GAME_ON" ? "🟢 ON" : "🔴 Off"}</span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300"><Lock size={10} /> Closed</span>
                )}
              </div>
              {p.playAt && <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400"><Calendar size={11} /> {fmtDateTime(p.playAt)}</p>}
              <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                <span>{p.voteCount} vote{p.voteCount !== 1 ? "s" : ""}</span>
                {p.isOpen && p.myVoted && <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 size={11} /> Voted</span>}
                {p.isOpen && !p.myVoted && data.myRole && <span className="font-bold text-blue-400">Vote now</span>}
              </div>
              {!p.isOpen && p.closeNote && <p className="mt-1 text-[11px] italic text-slate-400">“{p.closeNote}”</p>}
            </Link>
          ))}
        </div>
      )}

      {pollOpen && <NewPollModal token={token} groupId={id} onClose={() => setPollOpen(false)} onCreated={(pid) => { setPollOpen(false); navigate(`/groups/${id}/polls/${pid}`); }} />}
      {membersOpen && data && <ManageMembersModal token={token} group={data} onClose={() => setMembersOpen(false)} onChanged={refresh} onDeleted={() => navigate("/groups")} />}
    </div>
  );
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 pt-[max(2.5rem,env(safe-area-inset-top,0px))]">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-white">New poll</h3><button onClick={onClose} className="text-slate-400"><X size={18} /></button></div>
        <div className="space-y-3">
          <div><label className="mb-1 block text-[11px] text-slate-400">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Volleyball this Sunday 6pm?" className={inputCls} /></div>
          <div className="space-y-3">
            <div><label className="mb-1 block text-[11px] text-slate-400">Play time (opt)</label><input type="datetime-local" value={playAt} onChange={(e) => setPlayAt(e.target.value)} className={`${inputCls} min-w-0`} /></div>
            <div><label className="mb-1 block text-[11px] text-slate-400">Closes (opt)</label><input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={`${inputCls} min-w-0`} /></div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Options</label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={o} onChange={(e) => setOptions((p) => p.map((x, idx) => idx === i ? e.target.value : x))} className={inputCls} />
                  {options.length > 2 && <button onClick={() => setOptions((p) => p.filter((_, idx) => idx !== i))} className="shrink-0 text-slate-500"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
            {options.length < 6 && <button onClick={() => setOptions((p) => [...p, ""])} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-400"><Plus size={14} /> Add option</button>}
          </div>
          {err && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-[12px] text-red-200">{err}</p>}
          <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white active:bg-indigo-600 disabled:opacity-50">{busy ? "Posting…" : "Post & notify members"}</button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 pt-[max(2.5rem,env(safe-area-inset-top,0px))]">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-white">Manage members</h3><button onClick={onClose} className="text-slate-400"><X size={18} /></button></div>
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3">
          <Search size={15} className="text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a resident…" className="flex-1 bg-transparent py-2 text-sm text-slate-100 focus:outline-none" />
        </div>
        {hits.length > 0 && (
          <div className="mb-3 max-h-40 divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-700">
            {hits.map((h) => <button key={h.id} onClick={() => add(h.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm active:bg-slate-800"><span className="text-slate-200">{h.name}</span><span className="text-xs text-slate-500">B{h.block ?? "—"}, {h.flatNumber}</span></button>)}
          </div>
        )}
        <div className="max-h-72 divide-y divide-slate-800 overflow-y-auto">
          {group.members.map((m) => (
            <div key={m.residentId} className="flex items-center justify-between py-2">
              <div><p className="text-sm text-slate-200">{m.name} {m.role === "ORGANIZER" && <span className="text-xs text-blue-400">★</span>}</p><p className="text-xs text-slate-500">B{m.block ?? "—"}, {m.flatNumber}</p></div>
              <div className="flex items-center gap-2">
                {m.role === "MEMBER" ? <button onClick={() => setRole(m.residentId, "ORGANIZER")} className="text-xs text-blue-400">Promote</button> : <button onClick={() => setRole(m.residentId, "MEMBER")} className="text-xs text-slate-500">Demote</button>}
                <button onClick={() => remove(m.residentId)} className="text-slate-500"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-700 pt-4">
          <button onClick={deleteGroup} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-800 py-2 text-sm font-medium text-red-400 active:bg-red-900/20">
            <Trash2 size={15} /> Delete group
          </button>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) { return <div className="flex flex-1 items-center justify-center px-4">{children}</div>; }
const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none";
function fmtDateTime(iso: string): string { return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
