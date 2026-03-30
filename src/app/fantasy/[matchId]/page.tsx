"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import clsx from "clsx";
import {
  CalendarDays, MapPin, Lock, Users, CheckCircle,
  Crown, Zap, Swords, Shield, HandMetal,
  ChevronDown, ChevronUp, Info, ArrowLeft, Trophy, Flame,
} from "lucide-react";
import Link from "next/link";
import { TEAM_SIZE, MIN_BOWLERS, MAX_BOWLERS, MAX_BATSMEN } from "@/lib/fantasy";

const RCB_LOGO = "https://www.royalchallengers.com/themes/custom/rcbbase/images/rcb-logo-new.png";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreEvent {
  runs: number; wickets: number; catches: number; runOuts: number; stumpings: number;
}
interface Player {
  id: string; name: string; role: string; scoreEvent: ScoreEvent | null;
}
interface Match {
  id: string; title: string; opponent: string; venue: string | null;
  matchDate: string; status: string; players: Player[]; _count: { teams: number };
}
interface LeaderboardEntry {
  rank: number; teamId: string; name: string; phone: string; block: string;
  flatNumber: string; frozen: boolean; totalPoints: number;
  players: {
    playerId: string; name: string; role: string; isCaptain: boolean;
    isViceCaptain: boolean; basePoints: number; points: number; score: ScoreEvent | null;
  }[];
}
interface MyTeam {
  id: string; name: string; phone: string; frozen: boolean;
  players: { playerId: string; isCaptain: boolean; isViceCaptain: boolean; player: Player }[];
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, React.ReactNode> = {
  BATSMAN: <Swords size={11} />, BOWLER: <Zap size={11} />,
  ALLROUNDER: <Shield size={11} />, WICKETKEEPER: <HandMetal size={11} />,
};
const ROLE_LABEL: Record<string, string> = {
  BATSMAN: "BAT", BOWLER: "BOWL", ALLROUNDER: "AR", WICKETKEEPER: "WK",
};
const ROLE_COLOR: Record<string, string> = {
  BATSMAN:     "bg-blue-900/60 text-blue-300 border border-blue-700/40",
  BOWLER:      "bg-orange-900/60 text-orange-300 border border-orange-700/40",
  ALLROUNDER:  "bg-purple-900/60 text-purple-300 border border-purple-700/40",
  WICKETKEEPER:"bg-teal-900/60 text-teal-300 border border-teal-700/40",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const PAGE_BG = { background: "linear-gradient(160deg, #1a0505 0%, #2c0808 40%, #1a0505 100%)" };
const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
const CARD_RED = { background: "rgba(216,12,11,0.08)", border: "1px solid rgba(216,12,11,0.25)" };
const INPUT_STYLE = "w-full px-3 py-2 rounded-lg text-sm text-white placeholder-red-200/30 focus:outline-none focus:ring-1 focus:ring-yellow-500/50";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FantasyMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pick" | "leaderboard">("pick");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [vcId, setVcId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", block: "", flatNumber: "" });
  const [submitting, setSubmitting] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
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
      const res = await fetch(`/api/fantasy/matches/${matchId}`);
      const data = await res.json();
      setMatch(data.match);
      setLoading(false);
    }
    load();
    fetchLeaderboard();
  }, [matchId, fetchLeaderboard]);

  async function lookupTeam() {
    if (!phoneInput.trim()) return;
    setLookingUp(true); setError("");
    const res = await fetch(`/api/fantasy/matches/${matchId}/teams?phone=${encodeURIComponent(phoneInput.trim())}`);
    const data = await res.json();
    setLookingUp(false);
    setExistingTeamChecked(true);
    if (data.team) {
      const t: MyTeam = data.team;
      setMyTeam(t);
      setForm((p) => ({ ...p, name: t.name, phone: t.phone }));
      const ids = new Set(t.players.map((tp) => tp.playerId));
      setSelectedIds(ids);
      const cap = t.players.find((tp) => tp.isCaptain);
      const vc = t.players.find((tp) => tp.isViceCaptain);
      if (cap) setCaptainId(cap.playerId);
      if (vc) setVcId(vc.playerId);
    } else {
      setMyTeam(null);
      setForm((p) => ({ ...p, phone: phoneInput.trim() }));
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
        if (next.size >= TEAM_SIZE) return prev;
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
    const selected = [...selectedIds].map((id) => match!.players.find((p) => p.id === id)!);
    const bowlers = selected.filter((p) => p.role === "BOWLER").length;
    if (bowlers < MIN_BOWLERS) return setError(`Include at least ${MIN_BOWLERS} bowler.`);
    if (bowlers > MAX_BOWLERS) return setError(`Max ${MAX_BOWLERS} bowlers allowed.`);
    setSubmitting(true);
    const res = await fetch(`/api/fantasy/matches/${matchId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, playerIds: [...selectedIds], captainId, viceCaptainId: vcId }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return setError(data.error || "Failed to save team.");
    setMyTeam(data.team);
    setSuccess("Team saved! You can still edit until the match locks.");
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={PAGE_BG}>
      <div className="w-16 h-16 relative animate-pulse">
        <Image src={RCB_LOGO} alt="RCB" fill className="object-contain" unoptimized />
      </div>
    </div>
  );
  if (!match) return (
    <div className="min-h-screen flex items-center justify-center text-red-200/40" style={PAGE_BG}>
      Match not found.
    </div>
  );

  const isOpen = match.status === "OPEN";
  const selectedPlayers = [...selectedIds].map((id) => match.players.find((p) => p.id === id)!).filter(Boolean);
  const bowlerCount = selectedPlayers.filter((p) => p.role === "BOWLER").length;
  const batsmanCount = selectedPlayers.filter((p) => p.role === "BATSMAN").length;
  const teamValid = selectedIds.size === TEAM_SIZE && captainId && vcId &&
    bowlerCount >= MIN_BOWLERS && bowlerCount <= MAX_BOWLERS && batsmanCount <= MAX_BATSMEN;

  const byRole: Record<string, Player[]> = {};
  for (const p of match.players) {
    if (!byRole[p.role]) byRole[p.role] = [];
    byRole[p.role].push(p);
  }
  const roleOrder = ["BATSMAN", "BOWLER", "ALLROUNDER", "WICKETKEEPER"];
  const matchDate = new Date(match.matchDate);

  return (
    <div className="min-h-screen" style={PAGE_BG}>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-30"
          style={{ background: "linear-gradient(180deg, rgba(216,12,11,0.4) 0%, transparent 100%)" }} />
        <div className="relative max-w-3xl mx-auto px-4 pt-6 pb-6">
          <Link href="/fantasy" className="inline-flex items-center gap-1.5 text-sm text-red-200/60 hover:text-red-200 transition-colors mb-4">
            <ArrowLeft size={14} /> All Matches
          </Link>

          <div className="flex items-center gap-4">
            {/* RCB Logo */}
            <div className="relative w-16 h-16 shrink-0 drop-shadow-lg">
              <Image src={RCB_LOGO} alt="RCB" fill className="object-contain" unoptimized />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-red-300/60 uppercase tracking-widest">RCB vs {match.opponent}</span>
                <StatusBadge status={match.status} />
              </div>
              <h1 className="text-xl font-black text-white mt-0.5 leading-tight">{match.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-red-200/50 flex-wrap">
                <span className="flex items-center gap-1">
                  <CalendarDays size={11} />
                  {matchDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}
                  {matchDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {match.venue && <span className="flex items-center gap-1"><MapPin size={11} />{match.venue}</span>}
                <span className="flex items-center gap-1"><Users size={11} />{match._count.teams} teams</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gold divider line */}
      <div className="h-px" style={{ background: "linear-gradient(90deg, transparent 0%, #D80C0B 30%, #E7C641 50%, #D80C0B 70%, transparent 100%)" }} />

      {/* Tabs */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex border-b mt-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {(["pick", "leaderboard"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx(
                "px-5 py-3 text-sm font-semibold border-b-2 transition-all",
                tab === t
                  ? "border-yellow-400 text-yellow-400"
                  : "border-transparent text-red-200/40 hover:text-red-200/70"
              )}
            >
              {t === "pick" ? "🏏 Pick Team" : "🏆 Leaderboard"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* ── PICK TAB ── */}
        {tab === "pick" && (
          <>
            {/* Rules */}
            <div className="rounded-2xl p-4" style={CARD_RED}>
              <p className="text-xs font-bold text-yellow-400/80 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Info size={12} /> Team Rules
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-red-200/70">
                <span>✦ Select exactly 5 RCB players</span>
                <span>✦ Min 1, max 2 bowlers</span>
                <span>✦ Max 3 batsmen</span>
                <span>✦ Assign Captain (2×) & VC (1.5×)</span>
              </div>
            </div>

            {/* Phone lookup */}
            {!existingTeamChecked && (
              <div className="rounded-2xl p-5 space-y-3" style={CARD}>
                <h3 className="font-bold text-white text-sm">Already have a team?</h3>
                <p className="text-xs text-red-200/50">Enter your phone to load and continue editing.</p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Your mobile number"
                    onKeyDown={(e) => e.key === "Enter" && lookupTeam()}
                    className={INPUT_STYLE}
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <button
                    onClick={lookupTeam}
                    disabled={lookingUp || !phoneInput.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40"
                    style={{ background: "#D80C0B" }}
                  >
                    {lookingUp ? "…" : "Load"}
                  </button>
                </div>
                <button onClick={() => setExistingTeamChecked(true)}
                  className="text-xs text-red-200/30 hover:text-red-200/60 underline">
                  I&apos;m new — skip this
                </button>
              </div>
            )}

            {existingTeamChecked && (
              <>
                {/* Frozen notice */}
                {myTeam?.frozen && (
                  <div className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: "rgba(231,198,65,0.1)", border: "1px solid rgba(231,198,65,0.3)" }}>
                    <Lock size={16} className="text-yellow-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-yellow-300 text-sm">Team is frozen!</p>
                      <p className="text-xs text-yellow-400/60">Check the leaderboard as scores come in.</p>
                    </div>
                  </div>
                )}

                {/* Selection status bar */}
                {isOpen && !myTeam?.frozen && (
                  <div className="rounded-2xl p-3 flex items-center gap-2 flex-wrap" style={CARD}>
                    <SelectionChip ok={selectedIds.size === TEAM_SIZE} label={`${selectedIds.size}/${TEAM_SIZE} Players`} />
                    <SelectionChip ok={bowlerCount >= MIN_BOWLERS && bowlerCount <= MAX_BOWLERS} label={`${bowlerCount} Bowler${bowlerCount !== 1 ? "s" : ""}`} />
                    <SelectionChip ok={batsmanCount <= MAX_BATSMEN} label={`${batsmanCount} Batsmen`} />
                    <SelectionChip ok={!!captainId} label="C ✓" />
                    <SelectionChip ok={!!vcId} label="VC ✓" />
                  </div>
                )}

                {/* Player groups */}
                {roleOrder.map((role) => {
                  const players = byRole[role];
                  if (!players?.length) return null;
                  return (
                    <PlayerGroup key={role} role={role} players={players}
                      selectedIds={selectedIds} captainId={captainId} vcId={vcId}
                      canEdit={isOpen && !myTeam?.frozen}
                      onToggle={togglePlayer} onCaptain={assignCaptain} onVC={assignVC}
                    />
                  );
                })}

                {/* Details form */}
                {isOpen && !myTeam?.frozen && (
                  <div className="rounded-2xl p-5 space-y-4" style={CARD}>
                    <div className="flex items-center gap-2">
                      <div className="relative w-6 h-6 shrink-0">
                        <Image src={RCB_LOGO} alt="RCB" fill className="object-contain" unoptimized />
                      </div>
                      <h3 className="font-bold text-white text-sm">Your Details</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <DarkField label="Full Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Your name" />
                      <DarkField label="Phone *" type="tel" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="Mobile number" disabled={!!myTeam} />
                      <DarkField label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="your@email.com" />
                      <div>
                        <label className="block text-xs font-semibold text-red-200/60 mb-1 uppercase tracking-wide">Block *</label>
                        <select
                          value={form.block}
                          onChange={(e) => setForm((f) => ({ ...f, block: e.target.value }))}
                          className={clsx(INPUT_STYLE, "appearance-none")}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <option value="" style={{ background: "#2c0808" }}>Select Block</option>
                          {[1, 2, 3, 4].map((b) => <option key={b} value={String(b)} style={{ background: "#2c0808" }}>Block {b}</option>)}
                        </select>
                      </div>
                      <DarkField label="Flat Number *" value={form.flatNumber} onChange={(v) => setForm((f) => ({ ...f, flatNumber: v }))} placeholder="e.g. 101" />
                    </div>

                    {error && (
                      <div className="rounded-lg px-3 py-2 text-sm text-red-300"
                        style={{ background: "rgba(216,12,11,0.2)", border: "1px solid rgba(216,12,11,0.4)" }}>
                        {error}
                      </div>
                    )}
                    {success && (
                      <div className="rounded-lg px-3 py-2 text-sm text-green-300 flex items-center gap-2"
                        style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
                        <CheckCircle size={14} /> {success}
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={handleSave}
                        disabled={submitting || !teamValid}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={teamValid && !submitting
                          ? { background: "linear-gradient(135deg, #D80C0B, #ff2020)", boxShadow: "0 4px 15px rgba(216,12,11,0.4)" }
                          : { background: "rgba(255,255,255,0.1)" }}
                      >
                        {submitting ? "Saving…" : myTeam ? "Update Team" : "Save Team"}
                      </button>
                      {myTeam && !myTeam.frozen && (
                        <button
                          onClick={handleFreeze}
                          disabled={freezing}
                          className="px-5 py-3 rounded-xl text-sm font-bold text-black transition-all"
                          style={{ background: "linear-gradient(135deg, #E7C641, #f5d96b)", boxShadow: "0 4px 15px rgba(231,198,65,0.3)" }}
                        >
                          {freezing ? "…" : "🔒 Freeze"}
                        </button>
                      )}
                    </div>
                    {myTeam && !myTeam.frozen && (
                      <p className="text-xs text-red-200/30 text-center">
                        You can edit until you freeze or the match locks.
                      </p>
                    )}
                  </div>
                )}

                {!isOpen && (
                  <div className="rounded-2xl p-8 text-center" style={CARD}>
                    <Lock size={24} className="mx-auto mb-2 text-red-500/30" />
                    <p className="text-red-200/40 text-sm">Team selection is closed. Check the Leaderboard.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── LEADERBOARD TAB ── */}
        {tab === "leaderboard" && (
          <LeaderboardView leaderboard={leaderboard} status={match.status} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; style: React.CSSProperties }> = {
    OPEN:      { label: "Open",      style: { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" } },
    LOCKED:    { label: "Locked",    style: { background: "rgba(231,198,65,0.15)", border: "1px solid rgba(231,198,65,0.3)", color: "#fde68a" } },
    COMPLETED: { label: "Completed", style: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "#ffffff80" } },
  };
  const c = config[status] ?? config.OPEN;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={c.style}>{c.label}</span>
  );
}

function SelectionChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={ok
        ? { background: "rgba(231,198,65,0.15)", border: "1px solid rgba(231,198,65,0.3)", color: "#E7C641" }
        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }
      }>
      {ok ? "✓" : "·"} {label}
    </span>
  );
}

function PlayerGroup({ role, players, selectedIds, captainId, vcId, canEdit, onToggle, onCaptain, onVC }: {
  role: string; players: Player[]; selectedIds: Set<string>;
  captainId: string | null; vcId: string | null; canEdit: boolean;
  onToggle: (p: Player) => void; onCaptain: (id: string) => void; onVC: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const labels: Record<string, string> = {
    BATSMAN: "Batsmen", BOWLER: "Bowlers", ALLROUNDER: "All-rounders", WICKETKEEPER: "Wicket-keepers",
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <button onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-center gap-2">
          <span className={clsx("inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full", ROLE_COLOR[role])}>
            {ROLE_ICON[role]} {ROLE_LABEL[role]}
          </span>
          <span className="text-sm font-semibold text-white/80">{labels[role]}</span>
          <span className="text-xs text-white/20">({players.length})</span>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-white/30" /> : <ChevronUp size={14} className="text-white/30" />}
      </button>

      {!collapsed && (
        <div>
          {players.map((p) => {
            const isSelected = selectedIds.has(p.id);
            const isCap = captainId === p.id;
            const isVC = vcId === p.id;

            return (
              <div key={p.id}
                onClick={() => canEdit && onToggle(p)}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 border-t transition-colors",
                  canEdit && "cursor-pointer",
                  isSelected ? "bg-red-900/20" : "hover:bg-white/[0.02]"
                )}
                style={{ borderColor: "rgba(255,255,255,0.05)" }}
              >
                {/* Checkbox */}
                <div className={clsx(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                  isSelected ? "border-red-500" : "border-white/20"
                )} style={isSelected ? { background: "#D80C0B" } : {}}>
                  {isSelected && <CheckCircle size={12} className="text-white" />}
                </div>

                <span className="flex-1 text-sm font-medium text-white/90">{p.name}</span>

                {/* Captain/VC badges */}
                {isCap && (
                  <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(231,198,65,0.2)", color: "#E7C641", border: "1px solid rgba(231,198,65,0.4)" }}>
                    <Crown size={9} /> C
                  </span>
                )}
                {isVC && (
                  <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(147,197,253,0.15)", color: "#93c5fd", border: "1px solid rgba(147,197,253,0.3)" }}>
                    VC
                  </span>
                )}

                {/* Captain/VC buttons */}
                {isSelected && canEdit && (
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onCaptain(p.id)}
                      className="px-2 py-0.5 rounded text-xs font-bold transition-all"
                      style={isCap
                        ? { background: "#E7C641", color: "#1a0505" }
                        : { background: "rgba(231,198,65,0.1)", color: "rgba(231,198,65,0.6)", border: "1px solid rgba(231,198,65,0.2)" }}>
                      C
                    </button>
                    <button onClick={() => onVC(p.id)}
                      className="px-2 py-0.5 rounded text-xs font-bold transition-all"
                      style={isVC
                        ? { background: "#93c5fd", color: "#1a0505" }
                        : { background: "rgba(147,197,253,0.08)", color: "rgba(147,197,253,0.5)", border: "1px solid rgba(147,197,253,0.2)" }}>
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

function DarkField({ label, value, onChange, placeholder, type = "text", disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-red-200/60 mb-1 uppercase tracking-wide">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className={clsx(INPUT_STYLE, "disabled:opacity-40")}
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      />
    </div>
  );
}

function LeaderboardView({ leaderboard, status }: { leaderboard: LeaderboardEntry[]; status: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (leaderboard.length === 0) return (
    <div className="text-center py-20 text-red-200/30">
      <Trophy size={40} className="mx-auto mb-3 opacity-20" />
      <p>No teams yet.</p>
    </div>
  );

  const scoresEntered = status !== "OPEN" || leaderboard.some((e) => e.totalPoints > 0);

  return (
    <div className="space-y-3">
      {!scoresEntered && (
        <div className="rounded-xl px-4 py-3 text-sm text-center"
          style={{ background: "rgba(231,198,65,0.08)", border: "1px solid rgba(231,198,65,0.2)", color: "rgba(231,198,65,0.7)" }}>
          Scores will appear here once the match starts.
        </div>
      )}

      {leaderboard.map((entry) => (
        <div key={entry.teamId} className="rounded-2xl overflow-hidden"
          style={{
            background: entry.rank <= 3 ? "rgba(216,12,11,0.08)" : "rgba(255,255,255,0.03)",
            border: entry.rank === 1 ? "1px solid rgba(231,198,65,0.4)" :
                    entry.rank <= 3 ? "1px solid rgba(216,12,11,0.3)" :
                    "1px solid rgba(255,255,255,0.07)",
          }}>
          <button
            onClick={() => setExpanded(expanded === entry.teamId ? null : entry.teamId)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
          >
            {/* Rank */}
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
              style={
                entry.rank === 1 ? { background: "rgba(231,198,65,0.2)", color: "#E7C641" } :
                entry.rank === 2 ? { background: "rgba(200,200,200,0.15)", color: "#d1d5db" } :
                entry.rank === 3 ? { background: "rgba(180,100,50,0.2)", color: "#fca47a" } :
                { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
              }>
              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{entry.name}</span>
                {entry.frozen && <Lock size={10} className="text-yellow-400/50" />}
              </div>
              <p className="text-xs text-red-200/40">Block {entry.block} · {entry.flatNumber}</p>
            </div>

            <div className="text-right shrink-0">
              <div className="text-2xl font-black"
                style={entry.rank === 1 ? { color: "#E7C641" } : { color: "white" }}>
                {entry.totalPoints}
              </div>
              <div className="text-xs text-red-200/40">pts</div>
            </div>
          </button>

          {expanded === entry.teamId && (
            <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {entry.players.map((p) => (
                <div key={p.playerId}
                  className="flex items-center gap-3 px-4 py-2.5 border-b text-sm last:border-b-0"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <span className={clsx("text-xs px-1.5 py-0.5 rounded-full font-bold", ROLE_COLOR[p.role])}>
                    {ROLE_LABEL[p.role]}
                  </span>
                  <span className="flex-1 text-white/80 font-medium">
                    {p.name}
                    {p.isCaptain && <span className="ml-1 text-xs" style={{ color: "#E7C641" }}>(C)</span>}
                    {p.isViceCaptain && <span className="ml-1 text-xs text-blue-300">(VC)</span>}
                  </span>
                  {p.score && (
                    <span className="text-xs text-red-200/40 flex gap-1.5">
                      {p.score.runs > 0 && <span>{p.score.runs}r</span>}
                      {p.score.wickets > 0 && <span>{p.score.wickets}w</span>}
                      {p.score.catches > 0 && <span>{p.score.catches}ct</span>}
                      {p.score.runOuts > 0 && <span>{p.score.runOuts}ro</span>}
                      {p.score.stumpings > 0 && <span>{p.score.stumpings}st</span>}
                    </span>
                  )}
                  <span className="font-black text-white w-12 text-right">
                    {p.points}
                    {p.isCaptain && <span className="text-xs ml-0.5" style={{ color: "#E7C641" }}>×2</span>}
                    {p.isViceCaptain && <span className="text-xs ml-0.5 text-blue-300">×1.5</span>}
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
