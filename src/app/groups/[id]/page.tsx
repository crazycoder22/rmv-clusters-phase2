"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Users, Plus, Settings, X, Search, Trash2,
  Clock, Lock, CheckCircle2, Calendar,
} from "lucide-react";

interface Member {
  residentId: string;
  role: "ORGANIZER" | "MEMBER";
  name: string;
  block: number | null;
  flatNumber: string;
  googleImage: string | null;
}
interface PollSummary {
  id: string;
  title: string;
  playAt: string | null;
  closesAt: string | null;
  status: "OPEN" | "CLOSED";
  isOpen: boolean;
  outcome: "GAME_ON" | "CANCELLED" | null;
  closeNote: string | null;
  voteCount: number;
  myVoted: boolean;
  createdAt: string;
}
interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  myRole: "ORGANIZER" | "MEMBER" | null;
  canManage: boolean;
  members: Member[];
  polls: PollSummary[];
}

export default function GroupHomePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [data, setData] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${id}`);
      if (!res.ok) { setError(res.status === 404 ? "Group not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  async function join() {
    setBusy(true);
    try { const r = await fetch(`/api/groups/${id}/join`, { method: "POST" }); if (r.ok) await refresh(); }
    finally { setBusy(false); }
  }
  async function leave() {
    if (!confirm("Leave this group?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/groups/${id}/join`, { method: "DELETE" });
      if (r.ok) await refresh();
      else alert((await r.json().catch(() => null))?.error ?? "Could not leave");
    } finally { setBusy(false); }
  }

  if (loading) return <Centered><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="text-red-600 mb-3">{error ?? "Not found"}</p><Link href="/groups" className="text-blue-600 text-sm">← Groups</Link></div></Centered>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/groups" className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> Groups</Link>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Users className="text-blue-600" size={22} /> {data.name}</h1>
            {data.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{data.description}</p>}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{data.members.length} member{data.members.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="shrink-0">
            {data.myRole ? (
              data.canManage ? (
                <button type="button" onClick={() => setMembersOpen(true)} className="inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"><Settings size={14} /> Manage</button>
              ) : (
                <button type="button" onClick={leave} disabled={busy} className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600">Leave</button>
              )
            ) : (
              <button type="button" onClick={join} disabled={busy} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{busy ? "Joining…" : "Join group"}</button>
            )}
          </div>
        </div>

        {/* Member avatars */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {data.members.slice(0, 12).map((m) => (
            <span key={m.residentId} className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ${m.role === "ORGANIZER" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
              {m.role === "ORGANIZER" && "★ "}{m.name.split(" ")[0]}
            </span>
          ))}
          {data.members.length > 12 && <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">+{data.members.length - 12} more</span>}
        </div>

        {/* Polls */}
        <div className="flex items-center justify-between mt-8 mb-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Polls</h2>
          {data.canManage && (
            <button type="button" onClick={() => setPollOpen(true)} className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700"><Plus size={15} /> New poll</button>
          )}
        </div>

        {data.polls.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No polls yet.{data.canManage ? " Create one to ask who's playing." : ""}</p>
        ) : (
          <div className="space-y-2">
            {data.polls.map((p) => (
              <Link key={p.id} href={`/groups/${id}/polls/${p.id}`} className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{p.title}</h3>
                  {p.isOpen ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 rounded-full px-2 py-0.5"><Clock size={11} /> Open</span>
                  ) : p.outcome ? (
                    <span className={`shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${p.outcome === "GAME_ON" ? "text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300" : "text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300"}`}>{p.outcome === "GAME_ON" ? "🟢 Game ON" : "🔴 Cancelled"}</span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5"><Lock size={11} /> Closed</span>
                  )}
                </div>
                {p.playAt && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 inline-flex items-center gap-1"><Calendar size={12} /> {fmtDateTime(p.playAt)}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                  <span>{p.voteCount} vote{p.voteCount !== 1 ? "s" : ""}</span>
                  {p.isOpen && p.myVoted && <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={12} /> You voted</span>}
                  {p.isOpen && !p.myVoted && data.myRole && <span className="text-blue-600 font-semibold">Vote now</span>}
                </div>
                {!p.isOpen && p.closeNote && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">“{p.closeNote}”</p>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {pollOpen && <NewPollModal groupId={id} onClose={() => setPollOpen(false)} onCreated={async (pollId) => { setPollOpen(false); router.push(`/groups/${id}/polls/${pollId}`); }} />}
      {membersOpen && data && <ManageMembersModal group={data} onClose={() => setMembersOpen(false)} onChanged={refresh} />}
    </div>
  );
}

function NewPollModal({ groupId, onClose, onCreated }: { groupId: string; onClose: () => void; onCreated: (id: string) => void }) {
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
      const res = await fetch(`/api/groups/${groupId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          playAt: playAt ? new Date(playAt).toISOString() : null,
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
          options: clean,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setErr(d?.error ?? "Could not create"); return; }
      onCreated(d.id);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-10 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">New poll</h3>
          <button type="button" onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Volleyball this Sunday 6pm?" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Play time <span className="text-gray-400 font-normal">(opt)</span></label>
              <input type="datetime-local" value={playAt} onChange={(e) => setPlayAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voting closes <span className="text-gray-400 font-normal">(opt)</span></label>
              <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Options</label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={o} onChange={(e) => setOptions((p) => p.map((x, idx) => idx === i ? e.target.value : x))} className={inputCls} />
                  {options.length > 2 && <button type="button" onClick={() => setOptions((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
            {options.length < 6 && <button type="button" onClick={() => setOptions((p) => [...p, ""])} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><Plus size={14} /> Add option</button>}
          </div>
          {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">{busy ? "Posting…" : "Post poll & notify members"}</button>
        </div>
      </div>
    </div>
  );
}

function ManageMembersModal({ group, onClose, onChanged }: { group: GroupDetail; onClose: () => void; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; block: number | null; flatNumber: string }[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 1) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/residents/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const memberIds = new Set(group.members.map((m) => m.residentId));
        setHits(((await res.json()).residents ?? []).filter((r: { id: string }) => !memberIds.has(r.id)).slice(0, 10));
      }
    }, 250);
  }, [q, group.members]);

  async function add(residentId: string) {
    const r = await fetch(`/api/groups/${group.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ residentId }) });
    if (r.ok) { setQ(""); setHits([]); onChanged(); }
  }
  async function setRole(residentId: string, role: "ORGANIZER" | "MEMBER") {
    const r = await fetch(`/api/groups/${group.id}/members/${residentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    if (r.ok) onChanged(); else alert((await r.json().catch(() => null))?.error ?? "Could not update");
  }
  async function remove(residentId: string) {
    const r = await fetch(`/api/groups/${group.id}/members/${residentId}`, { method: "DELETE" });
    if (r.ok) onChanged(); else alert((await r.json().catch(() => null))?.error ?? "Could not remove");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-10 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Manage members</h3>
          <button type="button" onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-gray-50 dark:bg-gray-900 mb-2">
          <Search size={15} className="text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a resident…" className="flex-1 py-2 text-sm bg-transparent dark:text-gray-100 focus:outline-none" />
        </div>
        {hits.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700 mb-3 max-h-40 overflow-y-auto">
            {hits.map((h) => (
              <button key={h.id} type="button" onClick={() => add(h.id)} className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="dark:text-gray-200">{h.name}</span><span className="text-xs text-gray-400">B{h.block ?? "—"}, {h.flatNumber}</span>
              </button>
            ))}
          </div>
        )}
        <div className="divide-y dark:divide-gray-700 max-h-72 overflow-y-auto">
          {group.members.map((m) => (
            <div key={m.residentId} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-gray-800 dark:text-gray-200">{m.name} {m.role === "ORGANIZER" && <span className="text-xs text-blue-600">★ organizer</span>}</p>
                <p className="text-xs text-gray-400">B{m.block ?? "—"}, {m.flatNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.role === "MEMBER" ? (
                  <button type="button" onClick={() => setRole(m.residentId, "ORGANIZER")} className="text-xs text-blue-600 hover:underline">Make organizer</button>
                ) : (
                  <button type="button" onClick={() => setRole(m.residentId, "MEMBER")} className="text-xs text-gray-500 hover:underline">Demote</button>
                )}
                <button type="button" onClick={() => remove(m.residentId)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">{children}</div>;
}
const inputCls = "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
