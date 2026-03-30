"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import clsx from "clsx";
import {
  Trophy,
  CalendarDays,
  MapPin,
  Lock,
  Users,
  CheckCircle,
  Star,
  StarHalf,
  Swords,
  Crown,
  Shield,
  Zap,
  HandMetal,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { TEAM_SIZE, MIN_BOWLERS, MAX_BOWLERS, MAX_BATSMEN } from "@/lib/fantasy";

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
  venue: string | null;
  matchDate: string;
  status: string;
  players: Player[];
  _count: { teams: number };
}

interface LeaderboardEntry {
  rank: number;
  teamId: string;
  name: string;
  phone: string;
  block: string;
  flatNumber: string;
  frozen: boolean;
  totalPoints: number;
  players: {
    playerId: string;
    name: string;
    role: string;
    isCaptain: boolean;
    isViceCaptain: boolean;
    basePoints: number;
    points: number;
    score: ScoreEvent | null;
  }[];
}

interface MyTeam {
  id: string;
  name: string;
  phone: string;
  frozen: boolean;
  players: {
    playerId: string;
    isCaptain: boolean;
    isViceCaptain: boolean;
    player: Player;
  }[];
}

// ─── Role helpers ──────────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, React.ReactNode> = {
  BATSMAN: <Swords size={12} />,
  BOWLER: <Zap size={12} />,
  ALLROUNDER: <Shield size={12} />,
  WICKETKEEPER: <HandMetal size={12} />,
};

const ROLE_COLOR: Record<string, string> = {
  BATSMAN: "bg-blue-100 text-blue-700",
  BOWLER: "bg-orange-100 text-orange-700",
  ALLROUNDER: "bg-purple-100 text-purple-700",
  WICKETKEEPER: "bg-teal-100 text-teal-700",
};

const ROLE_LABEL: Record<string, string> = {
  BATSMAN: "BAT",
  BOWLER: "BOWL",
  ALLROUNDER: "AR",
  WICKETKEEPER: "WK",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FantasyMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pick" | "leaderboard">("pick");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [vcId, setVcId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ name: "", email: "", phone: "", block: "", flatNumber: "" });
  const [submitting, setSubmitting] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Phone lookup
  const [phoneInput, setPhoneInput] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [existingTeamChecked, setExistingTeamChecked] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    const res = await fetch(`/api/fantasy/matches/${matchId}/leaderboard`);
    const data = await res.json();
    setLeaderboard(data.leaderboard ?? []);
  }, [matchId]);

  useEffect(() => {
    async function load() {
      const [mRes] = await Promise.all([
        fetch(`/api/fantasy/matches/${matchId}`),
      ]);
      const mData = await mRes.json();
      setMatch(mData.match);
      setLoading(false);
    }
    load();
    fetchLeaderboard();
  }, [matchId, fetchLeaderboard]);

  async function lookupTeam() {
    if (!phoneInput.trim()) return;
    setLookingUp(true);
    setError("");
    const res = await fetch(`/api/fantasy/matches/${matchId}/teams?phone=${encodeURIComponent(phoneInput.trim())}`);
    const data = await res.json();
    setLookingUp(false);
    setExistingTeamChecked(true);

    if (data.team) {
      const t: MyTeam = data.team;
      setMyTeam(t);
      setForm((prev) => ({ ...prev, name: t.name, phone: t.phone }));
      // Re-populate selection
      const ids = new Set(t.players.map((tp) => tp.playerId));
      setSelectedIds(ids);
      const cap = t.players.find((tp) => tp.isCaptain);
      const vc = t.players.find((tp) => tp.isViceCaptain);
      if (cap) setCaptainId(cap.playerId);
      if (vc) setVcId(vc.playerId);
    } else {
      setMyTeam(null);
      setForm((prev) => ({ ...prev, phone: phoneInput.trim() }));
    }
  }

  function togglePlayer(player: Player) {
    if (match?.status !== "OPEN" || myTeam?.frozen) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(player.id)) {
        next.delete(player.id);
        if (captainId === player.id) setCaptainId(null);
        if (vcId === player.id) setVcId(null);
      } else {
        if (next.size >= TEAM_SIZE) return prev; // already 5
        // Role limit checks
        const current = [...next].map((id) => match!.players.find((p) => p.id === id)!);
        if (player.role === "BOWLER" && current.filter((p) => p.role === "BOWLER").length >= MAX_BOWLERS) return prev;
        if (player.role === "BATSMAN" && current.filter((p) => p.role === "BATSMAN").length >= MAX_BATSMEN) return prev;
        next.add(player.id);
      }
      return next;
    });
  }

  function assignCaptain(playerId: string) {
    if (playerId === vcId) setVcId(captainId);
    setCaptainId(playerId);
  }

  function assignVC(playerId: string) {
    if (playerId === captainId) setCaptainId(vcId);
    setVcId(playerId);
  }

  async function handleSave() {
    setError(""); setSuccess("");
    if (selectedIds.size !== TEAM_SIZE) return setError(`Select exactly ${TEAM_SIZE} players.`);
    if (!captainId || !vcId) return setError("Assign a captain and vice-captain.");
    if (!form.name || !form.phone || !form.block || !form.flatNumber) return setError("Fill in all your details.");

    // Validate bowler count
    const selected = [...selectedIds].map((id) => match!.players.find((p) => p.id === id)!);
    const bowlers = selected.filter((p) => p.role === "BOWLER").length;
    if (bowlers < MIN_BOWLERS) return setError(`Include at least ${MIN_BOWLERS} bowler.`);
    if (bowlers > MAX_BOWLERS) return setError(`Max ${MAX_BOWLERS} bowlers allowed.`);

    setSubmitting(true);
    const res = await fetch(`/api/fantasy/matches/${matchId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        playerIds: [...selectedIds],
        captainId,
        viceCaptainId: vcId,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return setError(data.error || "Failed to save team.");
    setMyTeam(data.team);
    setSuccess("Team saved! You can still edit it until the match is locked.");
    fetchLeaderboard();
  }

  async function handleFreeze() {
    if (!confirm("Freeze your team? You won't be able to make changes after this.")) return;
    setFreezing(true); setError(""); setSuccess("");
    const res = await fetch(`/api/fantasy/matches/${matchId}/teams`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: form.phone }),
    });
    const data = await res.json();
    setFreezing(false);
    if (!res.ok) return setError(data.error || "Failed to freeze.");
    setMyTeam(data.team);
    setSuccess("Your team is locked in! Good luck 🏏");
    fetchLeaderboard();
  }

  if (loading) {
    return (
      <div className="py-12 max-w-3xl mx-auto px-4">
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse mb-4" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!match) {
    return <div className="py-16 text-center text-gray-400">Match not found.</div>;
  }

  const matchDate = new Date(match.matchDate);
  const isOpen = match.status === "OPEN";
  const selectedPlayers = [...selectedIds]
    .map((id) => match.players.find((p) => p.id === id)!)
    .filter(Boolean);

  // Validation checks for the current selection
  const bowlerCount = selectedPlayers.filter((p) => p.role === "BOWLER").length;
  const batsmanCount = selectedPlayers.filter((p) => p.role === "BATSMAN").length;
  const teamValid =
    selectedIds.size === TEAM_SIZE &&
    captainId &&
    vcId &&
    bowlerCount >= MIN_BOWLERS &&
    bowlerCount <= MAX_BOWLERS &&
    batsmanCount <= MAX_BATSMEN;

  // Group players by role for display
  const byRole: Record<string, Player[]> = {};
  for (const p of match.players) {
    if (!byRole[p.role]) byRole[p.role] = [];
    byRole[p.role].push(p);
  }
  const roleOrder = ["BATSMAN", "BOWLER", "ALLROUNDER", "WICKETKEEPER"];

  return (
    <div className="py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Match header */}
        <div className="bg-gradient-to-r from-red-700 to-red-500 rounded-2xl p-6 text-white mb-6 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-bold text-red-100 text-sm uppercase tracking-wide">RCB</span>
            <span className="text-red-200 text-lg">vs</span>
            <span className="font-bold text-red-100 text-sm uppercase tracking-wide">{match.opponent}</span>
          </div>
          <h1 className="text-2xl font-bold">{match.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-red-100 text-sm flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarDays size={14} />
              {matchDate.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            {match.venue && (
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {match.venue}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users size={14} />
              {match._count.teams} teams
            </span>
          </div>
          <div className="mt-3">
            {match.status === "OPEN" && (
              <span className="inline-flex items-center gap-1 bg-green-400/20 border border-green-300/30 text-green-100 text-xs px-2.5 py-1 rounded-full">
                <CheckCircle size={12} /> Open for picks
              </span>
            )}
            {match.status === "LOCKED" && (
              <span className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-300/30 text-amber-100 text-xs px-2.5 py-1 rounded-full">
                <Lock size={12} /> Locked
              </span>
            )}
            {match.status === "COMPLETED" && (
              <span className="inline-flex items-center gap-1 bg-gray-400/20 border border-gray-300/30 text-gray-100 text-xs px-2.5 py-1 rounded-full">
                <Trophy size={12} /> Completed
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {(["pick", "leaderboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
                tab === t
                  ? "border-red-500 text-red-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {t === "pick" ? "🏏 Pick Your Team" : "🏆 Leaderboard"}
            </button>
          ))}
        </div>

        {/* ── PICK TAB ── */}
        {tab === "pick" && (
          <div className="space-y-6">
            {/* Points guide */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-yellow-800 mb-2 flex items-center gap-1">
                <Info size={13} /> Points System
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-yellow-900">
                <span>🏃 1 Run = 1 pt</span>
                <span>🎯 1 Wicket = 30 pts</span>
                <span>🙌 1 Catch = 20 pts</span>
                <span>🏃 Run-out / Stumping = 20 pts</span>
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                Captain earns <strong>2×</strong> points · Vice-Captain earns <strong>1.5×</strong> points
              </p>
            </div>

            {/* Rules */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">Team Rules</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>Select exactly 5 players (all from RCB)</li>
                <li>Minimum 1 bowler, maximum 2 bowlers</li>
                <li>Maximum 3 batsmen</li>
                <li>All-rounders and wicketkeepers fill the rest</li>
                <li>Assign 1 captain (2×) and 1 vice-captain (1.5×)</li>
              </ul>
            </div>

            {/* Phone lookup */}
            {!existingTeamChecked && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <h3 className="font-semibold text-gray-900">Already have a team?</h3>
                <p className="text-sm text-gray-500">Enter your phone number to load your existing team and continue editing.</p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Your mobile number"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    onKeyDown={(e) => e.key === "Enter" && lookupTeam()}
                  />
                  <button
                    onClick={lookupTeam}
                    disabled={lookingUp || !phoneInput.trim()}
                    className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {lookingUp ? "…" : "Load"}
                  </button>
                </div>
                <button
                  onClick={() => setExistingTeamChecked(true)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  I'm new — skip this
                </button>
              </div>
            )}

            {existingTeamChecked && (
              <>
                {/* Frozen team view */}
                {myTeam?.frozen && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <Lock size={18} className="text-green-600 shrink-0" />
                    <div>
                      <p className="font-medium text-green-800 text-sm">Your team is frozen!</p>
                      <p className="text-xs text-green-700">No changes allowed. Check the leaderboard as scores come in.</p>
                    </div>
                  </div>
                )}

                {/* Selection counter */}
                {isOpen && !myTeam?.frozen && (
                  <SelectionBar
                    count={selectedIds.size}
                    bowlers={bowlerCount}
                    batsmen={batsmanCount}
                    captainSet={!!captainId}
                    vcSet={!!vcId}
                  />
                )}

                {/* Player grid by role */}
                {roleOrder.map((role) => {
                  const players = byRole[role];
                  if (!players?.length) return null;
                  return (
                    <PlayerGroup
                      key={role}
                      role={role}
                      players={players}
                      selectedIds={selectedIds}
                      captainId={captainId}
                      vcId={vcId}
                      canEdit={isOpen && !myTeam?.frozen}
                      onToggle={togglePlayer}
                      onCaptain={assignCaptain}
                      onVC={assignVC}
                    />
                  );
                })}

                {/* My details form */}
                {isOpen && !myTeam?.frozen && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    <h3 className="font-semibold text-gray-900">Your Details</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <FormField label="Full Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Your name" />
                      <FormField label="Phone *" type="tel" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="Mobile number" disabled={!!myTeam} />
                      <FormField label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="your@email.com" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Block *</label>
                        <select
                          value={form.block}
                          onChange={(e) => setForm((f) => ({ ...f, block: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                        >
                          <option value="">Select Block</option>
                          {[1, 2, 3, 4].map((b) => <option key={b} value={String(b)}>Block {b}</option>)}
                        </select>
                      </div>
                      <FormField label="Flat Number *" value={form.flatNumber} onChange={(v) => setForm((f) => ({ ...f, flatNumber: v }))} placeholder="e.g. 101" />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {success && <p className="text-sm text-green-600">{success}</p>}

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={handleSave}
                        disabled={submitting || !teamValid}
                        className={clsx(
                          "flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors",
                          teamValid && !submitting
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-gray-300 cursor-not-allowed"
                        )}
                      >
                        {submitting ? "Saving…" : myTeam ? "Update Team" : "Save Team"}
                      </button>
                      {myTeam && !myTeam.frozen && (
                        <button
                          onClick={handleFreeze}
                          disabled={freezing}
                          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                        >
                          {freezing ? "…" : "🔒 Freeze"}
                        </button>
                      )}
                    </div>
                    {myTeam && !myTeam.frozen && (
                      <p className="text-xs text-gray-400 text-center">
                        You can keep editing until you freeze or the match locks.
                      </p>
                    )}
                  </div>
                )}

                {/* Locked / completed state */}
                {!isOpen && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center text-gray-500 text-sm">
                    <Lock size={20} className="mx-auto mb-2 text-gray-300" />
                    Team selection is closed. Switch to the Leaderboard tab.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── LEADERBOARD TAB ── */}
        {tab === "leaderboard" && (
          <LeaderboardView leaderboard={leaderboard} status={match.status} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SelectionBar({
  count, bowlers, batsmen, captainSet, vcSet,
}: {
  count: number; bowlers: number; batsmen: number; captainSet: boolean; vcSet: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex gap-3 flex-wrap">
          <Chip ok={count <= TEAM_SIZE} label={`${count}/${TEAM_SIZE} Players`} />
          <Chip ok={bowlers >= MIN_BOWLERS && bowlers <= MAX_BOWLERS} label={`${bowlers} Bowler${bowlers !== 1 ? "s" : ""}`} />
          <Chip ok={batsmen <= MAX_BATSMEN} label={`${batsmen} Batsmen`} />
          <Chip ok={captainSet} label="C" />
          <Chip ok={vcSet} label="VC" />
        </div>
      </div>
    </div>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
      ok ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-500"
    )}>
      {ok ? <CheckCircle size={10} /> : <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />}
      {label}
    </span>
  );
}

function PlayerGroup({
  role, players, selectedIds, captainId, vcId, canEdit, onToggle, onCaptain, onVC,
}: {
  role: string;
  players: Player[];
  selectedIds: Set<string>;
  captainId: string | null;
  vcId: string | null;
  canEdit: boolean;
  onToggle: (p: Player) => void;
  onCaptain: (id: string) => void;
  onVC: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const label = { BATSMAN: "Batsmen", BOWLER: "Bowlers", ALLROUNDER: "All-rounders", WICKETKEEPER: "Wicket-keepers" }[role] ?? role;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", ROLE_COLOR[role])}>
            {ROLE_ICON[role]} {ROLE_LABEL[role]}
          </span>
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-xs text-gray-400">({players.length})</span>
        </div>
        {collapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-50">
          {players.map((p) => {
            const isSelected = selectedIds.has(p.id);
            const isCap = captainId === p.id;
            const isVC = vcId === p.id;

            return (
              <div
                key={p.id}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  isSelected ? "bg-red-50" : "hover:bg-gray-50",
                  canEdit && "cursor-pointer"
                )}
                onClick={() => canEdit && onToggle(p)}
              >
                {/* Checkbox */}
                <div className={clsx(
                  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                  isSelected ? "bg-red-600 border-red-600" : "border-gray-300"
                )}>
                  {isSelected && <CheckCircle size={13} className="text-white" />}
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                    {isCap && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-semibold">
                        <Crown size={10} /> C
                      </span>
                    )}
                    {isVC && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-semibold">
                        <Star size={10} /> VC
                      </span>
                    )}
                  </div>
                </div>

                {/* Captain/VC buttons (only if selected) */}
                {isSelected && canEdit && (
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onCaptain(p.id)}
                      className={clsx(
                        "px-2 py-0.5 rounded text-xs font-semibold transition-colors",
                        isCap ? "bg-yellow-400 text-yellow-900" : "bg-gray-100 text-gray-600 hover:bg-yellow-100"
                      )}
                    >
                      C
                    </button>
                    <button
                      onClick={() => onVC(p.id)}
                      className={clsx(
                        "px-2 py-0.5 rounded text-xs font-semibold transition-colors",
                        isVC ? "bg-sky-400 text-white" : "bg-gray-100 text-gray-600 hover:bg-sky-100"
                      )}
                    >
                      VC
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, type = "text", disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  );
}

function LeaderboardView({ leaderboard, status }: { leaderboard: LeaderboardEntry[]; status: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Trophy size={40} className="mx-auto mb-3 opacity-20" />
        <p>No teams yet.</p>
      </div>
    );
  }

  const scoresEntered = status !== "OPEN" || leaderboard.some((e) => e.totalPoints > 0);

  return (
    <div className="space-y-3">
      {!scoresEntered && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 text-center">
          Scores will appear here once the match starts.
        </div>
      )}
      {leaderboard.map((entry) => (
        <div key={entry.teamId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === entry.teamId ? null : entry.teamId)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            {/* Rank medal */}
            <div className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
              entry.rank === 1 ? "bg-yellow-100 text-yellow-700" :
              entry.rank === 2 ? "bg-gray-100 text-gray-600" :
              entry.rank === 3 ? "bg-orange-100 text-orange-600" :
              "bg-gray-50 text-gray-400"
            )}>
              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">{entry.name}</span>
                {entry.frozen && <Lock size={11} className="text-gray-400" />}
              </div>
              <p className="text-xs text-gray-400">Block {entry.block} · {entry.flatNumber}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-gray-900 text-lg">{entry.totalPoints}</div>
              <div className="text-xs text-gray-400">pts</div>
            </div>
          </button>

          {expanded === entry.teamId && (
            <div className="border-t border-gray-100 divide-y divide-gray-50 text-sm">
              {entry.players.map((p) => (
                <div key={p.playerId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={clsx("text-xs px-1.5 py-0.5 rounded-full font-semibold", ROLE_COLOR[p.role])}>
                    {ROLE_LABEL[p.role]}
                  </span>
                  <span className="flex-1 text-gray-800 font-medium">
                    {p.name}
                    {p.isCaptain && <span className="ml-1 text-xs text-yellow-600">(C)</span>}
                    {p.isViceCaptain && <span className="ml-1 text-xs text-sky-600">(VC)</span>}
                  </span>
                  {p.score && (
                    <span className="text-xs text-gray-400 space-x-2">
                      {p.score.runs > 0 && <span>{p.score.runs}r</span>}
                      {p.score.wickets > 0 && <span>{p.score.wickets}w</span>}
                      {p.score.catches > 0 && <span>{p.score.catches}ct</span>}
                      {p.score.runOuts > 0 && <span>{p.score.runOuts}ro</span>}
                      {p.score.stumpings > 0 && <span>{p.score.stumpings}st</span>}
                    </span>
                  )}
                  <span className="font-semibold text-gray-900 w-10 text-right">
                    {p.points}
                    {p.isCaptain && <span className="text-xs text-yellow-500 ml-0.5">×2</span>}
                    {p.isViceCaptain && <span className="text-xs text-sky-500 ml-0.5">×1.5</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
