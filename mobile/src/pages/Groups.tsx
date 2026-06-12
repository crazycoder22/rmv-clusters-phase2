import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-start gap-3 py-3">
        <Link to="/community" className="flex pt-0.5" aria-label="Back">
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Groups</h1>
          <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>Sports &amp; activity groups</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-[14px] font-bold text-white active:opacity-90"
          style={{ background: "var(--accent-strong)" }}
        >
          <Icon name="add" size={17} style={{ color: "#fff" }} /> New
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-12" style={{ color: "var(--text-3)" }}><Loader2 size={22} className="animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="rounded-[18px] px-4 py-12 text-center text-[14px]" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-3)" }}>
          <Icon name="groups" size={28} className="mx-auto mb-2 block" style={{ color: "var(--text-3)" }} />
          No groups yet. Create the first one!
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {groups.map((g) => (
            <div key={g.id} className="rounded-[16px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <Link to={`/groups/${g.id}`} className="block">
                <h3 className="text-[18px] font-bold" style={{ color: "var(--text)" }}>{g.name}</h3>
                {g.description && <p className="mt-0.5 line-clamp-2 text-[14px]" style={{ color: "var(--text-2)" }}>{g.description}</p>}
                <p className="mt-1 text-[13px]" style={{ color: "var(--text-3)" }}>{g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</p>
              </Link>
              <div className="mt-3">
                {g.myRole === "ORGANIZER" ? (
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-bold" style={{ color: "var(--success)" }}>
                    <Icon name="star" size={18} fill style={{ color: "var(--success)" }} /> Organizer
                  </span>
                ) : g.myRole === "MEMBER" ? (
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-bold" style={{ color: "var(--success)" }}>
                    <Icon name="check_circle" size={18} fill style={{ color: "var(--success)" }} /> Joined
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => join(g.id)}
                    disabled={busyId === g.id}
                    className="w-full rounded-[11px] py-2.5 text-[14px] font-bold active:opacity-80 disabled:opacity-50"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
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
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3.5 pt-[max(2.5rem,env(safe-area-inset-top,0px))]" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="one-surface w-full max-w-md rounded-[22px] p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-[21px] font-extrabold" style={{ color: "var(--text)" }}>New group</h3>
          <button type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={24} style={{ color: "var(--text-3)" }} /></button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>Group name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday Volleyball" className="one-input w-full rounded-[11px] px-3.5 py-3 text-[15px]" />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When/where you usually play…" rows={3} className="one-input w-full rounded-[11px] px-3.5 py-3 text-[15px]" />
          </div>
          {err && <p className="rounded-[11px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}>{err}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full rounded-[13px] py-3.5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>{busy ? "Creating…" : "Create group"}</button>
        </div>
      </div>
    </div>
  );
}
