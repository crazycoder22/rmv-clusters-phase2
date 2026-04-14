"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Trophy, Users, Play, Star } from "lucide-react";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";
type Status = "WAITING" | "ACTIVE" | "COMPLETED";

interface Grid {
  cols: number;
  rows: number;
  pairs: number;
}

interface Card {
  idx: number;
  emoji: string | null;
  matched: boolean;
  flipped: boolean;
}

interface Player {
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  joinOrder: number;
  matches: number;
}

interface SessionState {
  code: string;
  status: Status;
  difficulty: Difficulty;
  grid: Grid;
  cards: Card[];
  flipA: number | null;
  flipB: number | null;
  matchedPairs: number;
  totalPairs: number;
  currentTurn: number;
  hostId: string;
  players: Player[];
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
}

const POLL_INTERVAL = 1500;
const REVEAL_DURATION = 1400;

// ── Card Component ─────────────────────────────────────────────────────────

function MemoryCard({
  card,
  onClick,
  disabled,
  size,
}: {
  card: Card;
  onClick: () => void;
  disabled: boolean;
  size: string;
}) {
  const isRevealed = card.flipped || card.matched;

  return (
    <div
      className={clsx("cursor-pointer", size, disabled && "cursor-not-allowed")}
      onClick={() => {
        if (!disabled && !card.matched && !card.flipped) onClick();
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 300ms ease-in-out",
          transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Face-down */}
        <div
          className={clsx(
            "absolute inset-0 rounded-xl flex items-center justify-center border-2",
            "bg-gradient-to-br from-primary-500 to-primary-700",
            "dark:from-primary-600 dark:to-primary-800",
            "border-primary-400 dark:border-primary-500",
            !disabled && "hover:scale-105 hover:shadow-lg transition-transform"
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <Star className="text-white/60" size={24} />
        </div>
        {/* Face-up */}
        <div
          className={clsx(
            "absolute inset-0 rounded-xl flex items-center justify-center border-2",
            card.matched
              ? "bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-500"
              : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
          )}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <span className="text-2xl sm:text-3xl select-none" role="img">
            {card.emoji || ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function MemoryMultiGamePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase();

  const { data: authSession, status: authStatus } = useSession();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(true);

  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [flipping, setFlipping] = useState(false);

  // Auth gate
  useEffect(() => {
    if (authStatus !== "loading" && !authSession) {
      signIn("google", { callbackUrl: `/memory/multi/${code}` });
    }
  }, [authSession, authStatus, code]);

  // Register player
  useEffect(() => {
    if (authStatus === "loading" || !authSession?.user?.email) return;

    fetch("/api/wordle/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSession: true }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          localStorage.setItem("memory_player_id", data.playerId);
          setPlayerId(data.playerId);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPlayer(false));
  }, [authSession, authStatus]);

  // Auto-join on first load
  useEffect(() => {
    if (!playerId || !code) return;
    fetch(`/api/memory/multi/sessions/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    }).catch(() => {});
  }, [playerId, code]);

  // Polling
  const fetchState = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/memory/multi/sessions/${code}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to load session");
        return;
      }
      const data = (await res.json()) as SessionState;
      setState(data);
      setError("");
    } catch {
      setError("Network error");
    }
  }, [code]);

  useEffect(() => {
    if (!playerId) return;
    fetchState();
    const id = setInterval(fetchState, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [playerId, fetchState]);

  // Auto-resolve when two cards are revealed — only the current-turn player triggers this.
  // Depend ONLY on the narrow fields that matter so polling doesn't re-run this effect
  // every 1.5s (which would clear the pending 1.4s timer and prevent resolve).
  const flipA = state?.flipA ?? null;
  const flipB = state?.flipB ?? null;
  const statusVal = state?.status;
  const currentTurnIdx = state?.currentTurn ?? -1;
  const currentTurnPlayerId =
    statusVal === "ACTIVE" && state
      ? state.players[currentTurnIdx]?.playerId ?? null
      : null;

  useEffect(() => {
    if (!playerId) return;
    if (statusVal !== "ACTIVE") return;
    if (flipA === null || flipB === null) return;
    if (currentTurnPlayerId !== playerId) return;

    const timer = setTimeout(() => {
      fetch(`/api/memory/multi/sessions/${code}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      })
        .then(() => fetchState())
        .catch(() => {});
    }, REVEAL_DURATION);

    return () => clearTimeout(timer);
  }, [flipA, flipB, statusVal, currentTurnPlayerId, playerId, code, fetchState]);

  const handleStart = async () => {
    if (!playerId || !code) return;
    const res = await fetch(`/api/memory/multi/sessions/${code}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Failed to start");
      return;
    }
    fetchState();
  };

  const handleFlip = async (idx: number) => {
    if (!playerId || !code || !state) return;
    if (state.status !== "ACTIVE") return;
    const currentPlayer = state.players[state.currentTurn];
    if (!currentPlayer || currentPlayer.playerId !== playerId) return;
    if (state.flipA !== null && state.flipB !== null) return;
    if (flipping) return;

    setFlipping(true);
    try {
      await fetch(`/api/memory/multi/sessions/${code}/flip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, cardIdx: idx }),
      });
      await fetchState();
    } finally {
      setFlipping(false);
    }
  };

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (authStatus === "loading" || !authSession || loadingPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => router.push("/memory/multi")}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white font-semibold"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading session...</div>
      </div>
    );
  }

  const isHost = state.hostId === playerId;
  const me = state.players.find((p) => p.playerId === playerId);
  const currentPlayer = state.players[state.currentTurn];
  const isMyTurn =
    state.status === "ACTIVE" && currentPlayer?.playerId === playerId;

  const winner =
    state.status === "COMPLETED"
      ? [...state.players].sort((a, b) => b.matches - a.matches)[0]
      : null;

  const sizeByDifficulty: Record<Difficulty, string> = {
    easy: "w-16 h-20 sm:w-20 sm:h-24",
    medium: "w-14 h-18 sm:w-18 sm:h-22",
    hard: "w-12 h-16 sm:w-16 sm:h-20",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/memory/multi"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Code:</span>
          <button
            onClick={handleCopy}
            className="font-mono text-lg font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40"
          >
            {state.code}
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div className="w-5" />
      </div>

      {/* Players / Scoreboard */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Users size={14} />
            Players ({state.players.length})
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {state.matchedPairs}/{state.totalPairs} pairs
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {state.players.map((p, i) => {
            const isCurrent = state.status === "ACTIVE" && i === state.currentTurn;
            const isMe = p.playerId === playerId;
            return (
              <div
                key={p.playerId}
                className={clsx(
                  "flex items-center justify-between p-2 rounded-lg border",
                  isCurrent
                    ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500"
                    : "border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {isCurrent && "▶ "}
                    {p.name}
                    {isMe && (
                      <span className="ml-1 text-xs text-primary-600 dark:text-primary-400">
                        (You)
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Block {p.block}
                    {p.flatNumber ? `, ${p.flatNumber}` : ""}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400 leading-none">
                    {p.matches}
                  </p>
                  <p className="text-[9px] uppercase text-gray-400">pairs</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status messages */}
      {state.status === "WAITING" && (
        <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-center">
          <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
            Waiting for players. Share the code <span className="font-mono font-bold">{state.code}</span> with your friends!
          </p>
          {isHost ? (
            <button
              onClick={handleStart}
              disabled={state.players.length < 2}
              className={clsx(
                "px-4 py-2 rounded-lg font-semibold text-white inline-flex items-center gap-2",
                state.players.length < 2
                  ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                  : "bg-primary-600 hover:bg-primary-700"
              )}
            >
              <Play size={16} />
              {state.players.length < 2 ? "Need 2+ players" : "Start Game"}
            </button>
          ) : (
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              Waiting for host to start…
            </p>
          )}
        </div>
      )}

      {state.status === "ACTIVE" && (
        <div
          className={clsx(
            "mb-4 text-center text-sm py-2 rounded-lg",
            isMyTurn
              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          )}
        >
          {isMyTurn
            ? "Your turn! Flip two cards."
            : `${currentPlayer?.name || "Player"}'s turn…`}
        </div>
      )}

      {state.status === "COMPLETED" && winner && (
        <div className="mb-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-center">
          <Trophy size={32} className="mx-auto text-yellow-500 mb-2" />
          <p className="text-base font-bold text-gray-800 dark:text-gray-100">
            {winner.name} wins!
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {winner.matches} pairs found
          </p>
        </div>
      )}

      {/* Board */}
      <div
        className="grid gap-2 sm:gap-3 justify-center mx-auto"
        style={{
          gridTemplateColumns: `repeat(${state.grid.cols}, minmax(0, 1fr))`,
          maxWidth: `${state.grid.cols * 80}px`,
        }}
      >
        {state.cards.map((card) => (
          <MemoryCard
            key={card.idx}
            card={card}
            onClick={() => handleFlip(card.idx)}
            disabled={
              !isMyTurn ||
              flipping ||
              (state.flipA !== null && state.flipB !== null)
            }
            size={sizeByDifficulty[state.difficulty]}
          />
        ))}
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
