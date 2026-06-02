import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Plus, X, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  myRole: "ORGANIZER" | "MEMBER" | null;
}

export default function Groups() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/groups", { token });
      if (res.ok) setGroups((await res.json()).groups ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function join(id: string) {
    setBusyId(id);
    try { const r = await apiFetch(`/api/groups/${id}/join`, { method: "POST", token }); if (r.ok) await refresh(); }
    finally { setBusyId(null); }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link to="/more" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">Groups</h1>
          <p className="truncate text-[11px] text-slate-500">Sports & activity groups</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="flex h-9 items-center gap-1 rounded-full bg-indigo-500 px-3 text-sm font-medium text-white active:bg-indigo-600">
          <Plus size={14} /> New
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500"><Loader2 size={22} className="animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-12 text-center text-sm text-slate-500">
          <Users size={28} className="mx-auto mb-2 text-slate-600" />
          No groups yet. Create the first one!
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {groups.map((g) => (
            <div key={g.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
              <Link to={`/groups/${g.id}`} className="block">
                <h3 className="text-sm font-semibold text-white">{g.name}</h3>
                {g.description && <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-400">{g.description}</p>}
                <p className="mt-1 text-[11px] text-slate-500">{g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</p>
              </Link>
              <div className="mt-2">
                {g.myRole ? (
                  <span className="text-[12px] font-medium text-emerald-400">{g.myRole === "ORGANIZER" ? "★ Organizer" : "✓ Joined"}</span>
                ) : (
                  <button type="button" onClick={() => join(g.id)} disabled={busyId === g.id} className="w-full rounded-lg bg-indigo-500/20 py-2 text-[13px] font-medium text-indigo-300 active:bg-indigo-500/30 disabled:opacity-50">
                    {busyId === g.id ? "Joining…" : "Join"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateGroupModal token={token} onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); navigate(`/groups/${id}`); }} />}
    </div>
  );
}

function CreateGroupModal({ token, onClose, onCreated }: { token: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!name.trim()) { setErr("Give the group a name"); return; }
    setBusy(true);
    try {
      const res = await apiFetch("/api/groups", { method: "POST", token, body: JSON.stringify({ name: name.trim(), description: description.trim() || null }) });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setErr(d?.error ?? "Could not create"); return; }
      onCreated(d.id);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[max(3rem,env(safe-area-inset-top,0px))]">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-white">New group</h3>
          <button type="button" onClick={onClose} className="text-slate-400"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Group name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday Volleyball" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When/where you usually play…" rows={2} className={inputCls} />
          </div>
          {err && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-[12px] text-red-200">{err}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white active:bg-indigo-600 disabled:opacity-50">{busy ? "Creating…" : "Create group"}</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none";
