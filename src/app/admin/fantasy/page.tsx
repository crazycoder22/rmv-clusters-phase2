"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRole } from "@/hooks/useRole";
import { useRouter } from "next/navigation";
import { Trophy, Plus, CalendarDays, Users, Lock, CheckCircle, ChevronRight, Trash2 } from "lucide-react";
import clsx from "clsx";

interface FantasyMatch {
  id: string;
  title: string;
  opponent: string;
  venue: string | null;
  matchDate: string;
  status: string;
  _count: { players: number; teams: number };
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  LOCKED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

export default function AdminFantasyPage() {
  const { canManageAnnouncements, isLoading } = useRole();
  const router = useRouter();
  const [matches, setMatches] = useState<FantasyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", opponent: "", venue: "", matchDate: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !canManageAnnouncements) router.replace("/");
  }, [isLoading, canManageAnnouncements, router]);

  useEffect(() => {
    fetch("/api/admin/fantasy/matches")
      .then((r) => r.json())
      .then((d) => setMatches(d.matches ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setError("");
    if (!form.title || !form.opponent || !form.matchDate) {
      return setError("Title, opponent and match date are required.");
    }
    setCreating(true);
    const res = await fetch("/api/admin/fantasy/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) return setError(data.error || "Failed to create.");
    setMatches((prev) => [data.match, ...prev]);
    setShowForm(false);
    setForm({ title: "", opponent: "", venue: "", matchDate: "" });
    router.push(`/admin/fantasy/${data.match.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this match and all its data?")) return;
    await fetch(`/api/admin/fantasy/matches/${id}`, { method: "DELETE" });
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }

  if (isLoading || loading) {
    return <div className="py-12 text-center text-gray-400">Loading…</div>;
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Trophy size={20} className="text-yellow-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fantasy Cricket</h1>
              <p className="text-sm text-gray-500">Manage matches, players and scores</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Plus size={16} />
            New Match
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Create New Match</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Match Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. RCB vs CSK – IPL 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opponent *</label>
                <input
                  value={form.opponent}
                  onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
                  placeholder="e.g. CSK"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Match Date *</label>
                <input
                  type="datetime-local"
                  value={form.matchDate}
                  onChange={(e) => setForm((f) => ({ ...f, matchDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                <input
                  value={form.venue}
                  onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                  placeholder="e.g. M. Chinnaswamy Stadium"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-300 transition-colors"
              >
                {creating ? "Creating…" : "Create Match"}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Match list */}
        {matches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trophy size={40} className="mx-auto mb-3 opacity-20" />
            <p>No matches yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <div key={m.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors group">
                <Link href={`/admin/fantasy/${m.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{m.title}</span>
                      <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[m.status])}>
                        {m.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        {new Date(m.matchDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span>{m._count.players} players</span>
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {m._count.teams} teams
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
                </Link>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  title="Delete match"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
