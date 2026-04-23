import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Shield, Trophy, Users } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import {
  type FantasyRole,
  ROLE_LABELS,
  TEAM_SIZE,
  validateTeam,
} from "../lib/fantasy";

type Status = "OPEN" | "LOCKED" | "COMPLETED";

type ScoreEvent = {
  runs: number;
  wickets: number;
  catches: number;
  runOuts: number;
  stumpings: number;
};

type Player = {
  id: string;
  name: string;
  role: FantasyRole;
  scoreEvent: ScoreEvent | null;
};

type Match = {
  id: string;
  title: string;
  opponent: string;
  venue: string;
  matchDate: string;
  status: Status;
  players: Player[];
  _count: { teams: number };
};

type TeamPlayer = {
  playerId: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  player: Player;
};

type Team = {
  id: string;
  name: string;
  phone: string;
  block: string;
  flatNumber: string;
  frozen: boolean;
  players: TeamPlayer[];
};

type LeaderboardEntry = {
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
    role: FantasyRole;
    isCaptain: boolean;
    isViceCaptain: boolean;
    points: number;
  }[];
};

type Tab = "leaderboard" | "team" | "players";

export default function FantasyMatch() {
  const { matchId = "" } = useParams<{ matchId: string }>();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("leaderboard");
  const [match, setMatch] = useState<Match | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    const [mRes, lbRes, teamRes] = await Promise.all([
      apiFetch(`/api/fantasy/matches/${matchId}`),
      apiFetch(`/api/fantasy/matches/${matchId}/leaderboard`),
      user?.phone
        ? apiFetch(
            `/api/fantasy/matches/${matchId}/teams?phone=${encodeURIComponent(user.phone)}`
          )
        : Promise.resolve(null),
    ]);
    if (mRes.ok) {
      const data = await mRes.json();
      setMatch(data.match);
    }
    if (lbRes.ok) {
      const data = await lbRes.json();
      setLeaderboard(data.leaderboard ?? []);
    }
    if (teamRes?.ok) {
      const data = await teamRes.json();
      setTeam(data.team);
    }
  }, [matchId, user?.phone]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/fantasy"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-base font-semibold text-white">
          {match?.title ?? "…"}
        </h1>
        <div className="h-9 w-9" />
      </header>

      {loading || !match ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
            <p className="text-sm text-white">
              vs <span className="font-semibold">{match.opponent}</span> ·{" "}
              <span className="text-slate-400">{match.venue}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {new Date(match.matchDate).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {match.status}
            </p>
          </div>

          <div className="mb-4 flex justify-center">
            <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
              <TabButton
                active={tab === "leaderboard"}
                onClick={() => setTab("leaderboard")}
              >
                <Trophy size={12} /> Leaderboard
              </TabButton>
              <TabButton
                active={tab === "team"}
                onClick={() => setTab("team")}
              >
                <Shield size={12} /> My Team
              </TabButton>
              <TabButton
                active={tab === "players"}
                onClick={() => setTab("players")}
              >
                <Users size={12} /> Players
              </TabButton>
            </div>
          </div>

          {tab === "leaderboard" && (
            <LeaderboardView entries={leaderboard} myPhone={user?.phone} />
          )}
          {tab === "players" && <PlayersView players={match.players} />}
          {tab === "team" && (
            <TeamView
              match={match}
              team={team}
              onSaved={() => refresh()}
            />
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-slate-700 text-white shadow-sm" : "text-slate-400"
      )}
    >
      {children}
    </button>
  );
}

// ── Leaderboard view ────────────────────────────────────────────────────────

function LeaderboardView({
  entries,
  myPhone,
}: {
  entries: LeaderboardEntry[];
  myPhone?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        No teams yet.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
      <div className="divide-y divide-slate-700">
        {entries.map((e) => {
          const badge =
            e.rank === 1
              ? "🥇"
              : e.rank === 2
                ? "🥈"
                : e.rank === 3
                  ? "🥉"
                  : String(e.rank);
          const mine = myPhone && e.phone === myPhone;
          return (
            <div
              key={e.teamId}
              className={clsx(
                "px-4 py-3",
                mine && "bg-indigo-500/10"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold">
                    {badge}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {e.name}
                      {mine && (
                        <span className="ml-1.5 text-xs text-indigo-400">
                          (You)
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Block {e.block}
                      {e.flatNumber ? `, ${e.flatNumber}` : ""}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-amber-300">
                  {e.totalPoints}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Players view ────────────────────────────────────────────────────────────

function PlayersView({ players }: { players: Player[] }) {
  const byRole = new Map<FantasyRole, Player[]>();
  for (const p of players) {
    const list = byRole.get(p.role) ?? [];
    list.push(p);
    byRole.set(p.role, list);
  }
  const order: FantasyRole[] = [
    "WICKETKEEPER",
    "BATSMAN",
    "ALLROUNDER",
    "BOWLER",
  ];

  return (
    <div className="space-y-4">
      {order.map((role) => {
        const list = byRole.get(role) ?? [];
        if (list.length === 0) return null;
        return (
          <div key={role}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {ROLE_LABELS[role]}
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
              {list.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5 last:border-0"
                >
                  <p className="text-sm text-slate-100">{p.name}</p>
                  {p.scoreEvent && (
                    <ScoreChip score={p.scoreEvent} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreChip({ score }: { score: ScoreEvent }) {
  const bits = [
    score.runs > 0 ? `${score.runs}r` : null,
    score.wickets > 0 ? `${score.wickets}w` : null,
    score.catches > 0 ? `${score.catches}c` : null,
    score.runOuts > 0 ? `${score.runOuts}ro` : null,
    score.stumpings > 0 ? `${score.stumpings}st` : null,
  ].filter(Boolean);
  if (bits.length === 0)
    return <span className="text-[11px] text-slate-500">—</span>;
  return (
    <span className="font-mono text-[11px] text-green-400">
      {bits.join(" · ")}
    </span>
  );
}

// ── Team view (read-only or builder) ───────────────────────────────────────

function TeamView({
  match,
  team,
  onSaved,
}: {
  match: Match;
  team: Team | null;
  onSaved: () => void;
}) {
  if (team?.frozen) return <TeamReadOnly team={team} />;
  if (match.status !== "OPEN")
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 py-10 text-center text-sm text-slate-400">
        Team selection is closed for this match.
      </div>
    );
  return <TeamBuilder match={match} existing={team} onSaved={onSaved} />;
}

function TeamReadOnly({ team }: { team: Team }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
        <p className="text-sm font-semibold text-white">{team.name}</p>
        <p className="mt-0.5 text-xs text-amber-300">Frozen — final</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
        {team.players.map((tp) => (
          <div
            key={tp.playerId}
            className="flex items-center justify-between border-b border-slate-700 px-4 py-3 last:border-0"
          >
            <div>
              <p className="text-sm text-slate-100">
                {tp.player.name}
                {tp.isCaptain && (
                  <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    C
                  </span>
                )}
                {tp.isViceCaptain && (
                  <span className="ml-1.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                    VC
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                {ROLE_LABELS[tp.player.role]}
              </p>
            </div>
            {tp.player.scoreEvent && <ScoreChip score={tp.player.scoreEvent} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamBuilder({
  match,
  existing,
  onSaved,
}: {
  match: Match;
  existing: Team | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(existing?.players.map((p) => p.playerId) ?? [])
  );
  const [captainId, setCaptainId] = useState<string | null>(
    existing?.players.find((p) => p.isCaptain)?.playerId ?? null
  );
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(
    existing?.players.find((p) => p.isViceCaptain)?.playerId ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlayers = match.players.filter((p) => selected.has(p.id));
  const validationError = validateTeam(
    selectedPlayers,
    captainId,
    viceCaptainId
  );

  const toggle = (id: string) => {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (captainId === id) setCaptainId(null);
        if (viceCaptainId === id) setViceCaptainId(null);
      } else {
        if (next.size >= TEAM_SIZE) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const save = async () => {
    if (validationError || !user) {
      setError(validationError ?? "Sign in required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/fantasy/matches/${match.id}/teams`,
        {
          method: "POST",
          body: JSON.stringify({
            name: user.name,
            email: user.email,
            phone: user.phone,
            block: String(user.block),
            flatNumber: user.flatNumber,
            playerIds: Array.from(selected),
            captainId,
            viceCaptainId,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const freeze = async () => {
    if (!user?.phone) return;
    if (!confirm("Freeze this team? You won't be able to change it.")) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/fantasy/matches/${match.id}/teams`, {
        method: "PATCH",
        body: JSON.stringify({ phone: user.phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to freeze");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const byRole = new Map<FantasyRole, Player[]>();
  for (const p of match.players) {
    const list = byRole.get(p.role) ?? [];
    list.push(p);
    byRole.set(p.role, list);
  }
  const roleOrder: FantasyRole[] = [
    "WICKETKEEPER",
    "BATSMAN",
    "ALLROUNDER",
    "BOWLER",
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
        <p className="text-xs text-slate-400">
          Pick {TEAM_SIZE} players. 1-2 bowlers, ≤ 3 batsmen.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Captain earns 2× · Vice-captain 1.5×
        </p>
        <p className="mt-2 text-sm font-semibold text-white">
          Selected: {selected.size}/{TEAM_SIZE}
        </p>
      </div>

      {roleOrder.map((role) => {
        const list = byRole.get(role) ?? [];
        if (list.length === 0) return null;
        return (
          <div key={role}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {ROLE_LABELS[role]}
            </p>
            <div className="space-y-1.5">
              {list.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={clsx(
                      "overflow-hidden rounded-lg border transition-colors",
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-700 bg-slate-800/40"
                    )}
                  >
                    <button
                      onClick={() => toggle(p.id)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                    >
                      <span className="text-sm text-slate-100">{p.name}</span>
                      <span
                        className={clsx(
                          "text-xs",
                          isSelected ? "text-indigo-300" : "text-slate-500"
                        )}
                      >
                        {isSelected ? "Selected" : "Tap to add"}
                      </span>
                    </button>
                    {isSelected && (
                      <div className="flex items-center gap-2 border-t border-slate-700/50 px-4 py-2">
                        <RoleToggle
                          label="Captain (2×)"
                          icon={<Crown size={11} />}
                          active={captainId === p.id}
                          onClick={() => {
                            if (viceCaptainId === p.id) setViceCaptainId(null);
                            setCaptainId(captainId === p.id ? null : p.id);
                          }}
                        />
                        <RoleToggle
                          label="VC (1.5×)"
                          icon={<Shield size={11} />}
                          active={viceCaptainId === p.id}
                          onClick={() => {
                            if (captainId === p.id) setCaptainId(null);
                            setViceCaptainId(
                              viceCaptainId === p.id ? null : p.id
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
          {error}
        </p>
      )}
      {!error && validationError && selected.size > 0 && (
        <p className="text-center text-xs text-slate-500">{validationError}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !!validationError}
          className="flex-1 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-40"
        >
          {saving ? "Saving…" : existing ? "Update team" : "Save team"}
        </button>
        {existing && !existing.frozen && (
          <button
            onClick={freeze}
            disabled={saving}
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 active:bg-amber-500/20 disabled:opacity-40"
          >
            Freeze
          </button>
        )}
      </div>
    </div>
  );
}

function RoleToggle({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors",
        active
          ? "bg-amber-500 text-slate-900"
          : "bg-slate-700 text-slate-400 active:bg-slate-600"
      )}
    >
      {icon} {label}
    </button>
  );
}
