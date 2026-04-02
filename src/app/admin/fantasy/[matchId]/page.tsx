"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import clsx from "clsx";
import {
  Trophy, Plus, Trash2, Lock, CheckCircle, ArrowLeft,
  Zap, Swords, Shield, HandMetal, Save, Users
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreEvent {
  runs: number;
  wickets: number;
  catches: number;
  runOuts: number;
  stumpings: number;
}

interface Player {
  id: string;
  name: string;
  role: string;
  scoreEvent: ScoreEvent | null;
}

interface Match {
  id: string;
  title: string;
  opponent: string;
  matchDate: string;
  status: string;
  players: Player[];
  _count: { teams: number };
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, React.ReactNode> = {
  BATSMAN: <Swords size={13} />,
  BOWLER: <Zap size={13} />,
  ALLROUNDER: <Shield size={13} />,
  WICKETKEEPER: <HandMetal size={13} />,
};

const ROLE_COLOR: Record<string, string> = {
  BATSMAN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  BOWLER: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  ALLROUNDER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  WICKETKEEPER: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

const STATUS_NEXT: Record<string, { label: string; value: string; color: string }> = {
  OPEN: { label: "🔒 Lock Match (stop picks)", value: "LOCKED", color: "bg-amber-500 hover:bg-amber-600" },
  LOCKED: { label: "✅ Mark as Completed", value: "COMPLETED", color: "bg-green-600 hover:bg-green-700" },
  COMPLETED: { label: "Reopen Match", value: "OPEN", color: "bg-gray-500 hover:bg-gray-600" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFantasyMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { canManageAnnouncements, isLoading: roleLoading } = useRole();
  const router = useRouter();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"players" | "scores">("players");

  // Player add form
  const [newPlayer, setNewPlayer] = useState({ name: "", role: "BATSMAN" });
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState("");

  // Score editing: local map of playerId → score fields
  const [scores, setScores] = useState<Record<string, ScoreEvent>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [scoreSuccess, setScoreSuccess] = useState("");

  const [statusChanging, setStatusChanging] = useState(false);

  useEffect(() => {
    if (!roleLoading && !canManageAnnouncements) router.replace("/");
  }, [roleLoading, canManageAnnouncements, router]);

  const fetchMatch = useCallback(async () => {
    const res = await fetch(`/api/fantasy/matches/${matchId}`);
    const data = await res.json();
    setMatch(data.match);
    // Seed score inputs from existing scoreEvents
    const initial: Record<string, ScoreEvent> = {};
    for (const p of data.match?.players ?? []) {
      initial[p.id] = p.scoreEvent ?? { runs: 0, wickets: 0, catches: 0, runOuts: 0, stumpings: 0 };
    }
    setScores(initial);
    setLoading(false);
  }, [matchId]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  async function handleAddPlayer() {
    setPlayerError("");
    if (!newPlayer.name.trim()) return setPlayerError("Player name is required.");
    setAddingPlayer(true);
    const res = await fetch(`/api/admin/fantasy/matches/${matchId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPlayer.name.trim(), role: newPlayer.role }),
    });
    const data = await res.json();
    setAddingPlayer(false);
    if (!res.ok) return setPlayerError(data.error || "Failed to add player.");
    const p: Player = { ...data.player, scoreEvent: null };
    setMatch((m) => m ? { ...m, players: [...m.players, p] } : m);
    setScores((s) => ({ ...s, [p.id]: { runs: 0, wickets: 0, catches: 0, runOuts: 0, stumpings: 0 } }));
    setNewPlayer({ name: "", role: "BATSMAN" });
  }

  async function handleDeletePlayer(playerId: string) {
    if (!confirm("Remove this player?")) return;
    await fetch(`/api/admin/fantasy/matches/${matchId}/players/${playerId}`, { method: "DELETE" });
    setMatch((m) => m ? { ...m, players: m.players.filter((p) => p.id !== playerId) } : m);
    setScores((s) => { const next = { ...s }; delete next[playerId]; return next; });
  }

  function updateScore(playerId: string, field: keyof ScoreEvent, raw: string) {
    const val = Math.max(0, parseInt(raw) || 0);
    setScores((s) => ({ ...s, [playerId]: { ...s[playerId], [field]: val } }));
  }

  async function handleSaveScores() {
    setSavingScores(true); setScoreSuccess("");
    const scoreArray = Object.entries(scores).map(([playerId, s]) => ({ playerId, ...s }));
    const res = await fetch(`/api/admin/fantasy/matches/${matchId}/scores`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores: scoreArray }),
    });
    setSavingScores(false);
    if (res.ok) setScoreSuccess("Scores saved successfully!");
  }

  async function handleStatusChange(newStatus: string) {
    if (!confirm(`Change status to ${newStatus}?`)) return;
    setStatusChanging(true);
    const res = await fetch(`/api/admin/fantasy/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    setStatusChanging(false);
    if (res.ok) setMatch((m) => m ? { ...m, status: data.match.status } : m);
  }

  if (roleLoading || loading) {
    return <div className="py-12 text-center text-gray-400">Loading…</div>;
  }
  if (!match) {
    return <div className="py-12 text-center text-gray-400">Match not found.</div>;
  }

  const nextStatus = STATUS_NEXT[match.status];
  const roleOrder = ["BATSMAN", "BOWLER", "ALLROUNDER", "WICKETKEEPER"];

  return (
    <div className="py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Back */}
        <Link href="/admin/fantasy" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5">
          <ArrowLeft size={14} /> Back to matches
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-500 rounded-2xl p-6 text-white mb-6 shadow">
          <h1 className="text-xl font-bold">{match.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-red-100 text-sm flex-wrap">
            <span>{new Date(match.matchDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
            <span className="flex items-center gap-1"><Users size={13} /> {match._count.teams} teams</span>
            <span className={clsx(
              "px-2.5 py-0.5 rounded-full text-xs font-semibold",
              match.status === "OPEN" ? "bg-green-400/30 text-green-100" :
              match.status === "LOCKED" ? "bg-amber-400/30 text-amber-100" :
              "bg-gray-400/30 text-gray-100"
            )}>
              {match.status}
            </span>
          </div>
          {/* Status change button */}
          {nextStatus && (
            <button
              onClick={() => handleStatusChange(nextStatus.value)}
              disabled={statusChanging}
              className={clsx(
                "mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors",
                nextStatus.color, "disabled:opacity-60"
              )}
            >
              {statusChanging ? "Updating…" : nextStatus.label}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {(["players", "scores"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                tab === t ? "border-red-500 text-red-600 dark:text-red-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              )}
            >
              {t === "players" ? "🏏 Players" : "📊 Scores"}
            </button>
          ))}
        </div>

        {/* ── PLAYERS TAB ── */}
        {tab === "players" && (
          <div className="space-y-5">
            {/* Add player form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Add Player</h3>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Player name"
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                  onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
                />
                <select
                  value={newPlayer.role}
                  onChange={(e) => setNewPlayer((p) => ({ ...p, role: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                >
                  <option value="BATSMAN">Batsman</option>
                  <option value="BOWLER">Bowler</option>
                  <option value="ALLROUNDER">All-rounder</option>
                  <option value="WICKETKEEPER">Wicket-keeper</option>
                </select>
                <button
                  onClick={handleAddPlayer}
                  disabled={addingPlayer}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors"
                >
                  <Plus size={15} />
                  {addingPlayer ? "Adding…" : "Add"}
                </button>
              </div>
              {playerError && <p className="text-sm text-red-600 dark:text-red-300">{playerError}</p>}
            </div>

            {/* Players list grouped by role */}
            {match.players.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                No players yet. Add your RCB playing XI above.
              </div>
            ) : (
              roleOrder.map((role) => {
                const players = match.players.filter((p) => p.role === role);
                if (!players.length) return null;
                return (
                  <div key={role} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                      <span className={clsx("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", ROLE_COLOR[role])}>
                        {ROLE_ICON[role]}
                        {role === "WICKETKEEPER" ? "Wicket-keepers" : `${role.charAt(0)}${role.slice(1).toLowerCase()}s`}
                      </span>
                      <span className="text-xs text-gray-400">({players.length})</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                      {players.map((p) => (
                        <div key={p.id} className="flex items-center px-4 py-3 gap-3">
                          <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                          <button
                            onClick={() => handleDeletePlayer(p.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── SCORES TAB ── */}
        {tab === "scores" && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
              Enter the <strong>final totals</strong> for each player (e.g. total runs scored, wickets taken, catches, run-outs, stumpings). Points are calculated automatically.
            </div>

            {match.players.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Add players first in the Players tab.</div>
            ) : (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                          <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-40">Player</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-20">Role</th>
                          <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Runs</th>
                          <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Wkts</th>
                          <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Catch</th>
                          <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Run-out</th>
                          <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Stump</th>
                          <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {roleOrder.flatMap((role) =>
                          match.players
                            .filter((p) => p.role === role)
                            .map((p) => {
                              const s = scores[p.id] ?? { runs: 0, wickets: 0, catches: 0, runOuts: 0, stumpings: 0 };
                              const pts = s.runs * 1 + s.wickets * 30 + s.catches * 20 + s.runOuts * 20 + s.stumpings * 20;
                              return (
                                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{p.name}</td>
                                  <td className="px-4 py-2.5">
                                    <span className={clsx("inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold", ROLE_COLOR[p.role])}>
                                      {ROLE_ICON[p.role]}
                                    </span>
                                  </td>
                                  {(["runs", "wickets", "catches", "runOuts", "stumpings"] as (keyof ScoreEvent)[]).map((field) => (
                                    <td key={field} className="px-2 py-2">
                                      <input
                                        type="number"
                                        min={0}
                                        value={s[field]}
                                        onChange={(e) => updateScore(p.id, field, e.target.value)}
                                        className="w-16 text-center px-2 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-3 py-2.5 text-center font-bold text-gray-900 dark:text-gray-100">{pts}</td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSaveScores}
                    disabled={savingScores}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors"
                  >
                    <Save size={15} />
                    {savingScores ? "Saving…" : "Save All Scores"}
                  </button>
                  {scoreSuccess && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle size={15} /> {scoreSuccess}
                    </span>
                  )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400">
                  <strong>Points formula:</strong> 1 run = 1pt · 1 wicket = 30pts · 1 catch = 20pts · run-out = 20pts · stumping = 20pts.
                  Captain gets 2× · Vice-captain gets 1.5× (applied on leaderboard).
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
