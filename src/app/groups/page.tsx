"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import Link from "next/link";
import { Users, Plus, X } from "lucide-react";

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  myRole: "ORGANIZER" | "MEMBER" | null;
}

export default function GroupsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useRequireSignIn(status);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/groups");
      if (res.ok) setGroups((await res.json()).groups ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function join(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/groups/${id}/join`, { method: "POST" });
      if (res.ok) await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="text-blue-600" /> Groups
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Sports & activity groups — join and vote on the next game</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New group
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : groups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-16 text-center text-gray-500 dark:text-gray-400">
            <Users size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No groups yet. Create the first one!</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col">
                <Link href={`/groups/${g.id}`} className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{g.name}</h3>
                  {g.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{g.description}</p>}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</p>
                </Link>
                <div className="mt-3">
                  {g.myRole ? (
                    <Link href={`/groups/${g.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400">
                      {g.myRole === "ORGANIZER" ? "★ Organizer" : "✓ Joined"}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => join(g.id)}
                      disabled={busyId === g.id}
                      className="w-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg py-2 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50"
                    >
                      {busyId === g.id ? "Joining…" : "Join"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen && <CreateGroupModal onClose={() => setCreateOpen(false)} onCreated={async (id) => { setCreateOpen(false); router.push(`/groups/${id}`); }} />}
    </div>
  );
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!name.trim()) { setErr("Give the group a name"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setErr(d?.error ?? "Could not create"); return; }
      onCreated(d.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">New group</h3>
          <button type="button" onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday Volleyball" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When/where you usually play, skill level, etc." rows={2} className={inputCls} />
          </div>
          {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
