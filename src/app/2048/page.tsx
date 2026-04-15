"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Trophy, RotateCcw, Info, X } from "lucide-react";
import clsx from "clsx";
import {
  Board,
  Direction,
  createBoard,
  move as applyMove,
  spawnTile,
  isGameOver,
  getHighestTile,
  WIN_TILE,
} from "@/lib/game2048";

// ── Types ──────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  score: number;
  highestTile: number;
  moves: number;
  duration: number;
  won: boolean;
}

type LeaderboardScope = "alltime" | "weekly";

// ── Tile styling ───────────────────────────────────────────────────────────

// Classic 2048 palette, adapted for dark mode. The empty-cell color must be
// visibly different from the board background so the 4x4 grid stays legible.
const TILE_STYLES: Record<number, { bg: string; text: string; darkBg?: string }> = {
  0:    { bg: "bg-[#cdc1b4] dark:bg-gray-800", text: "" },
  2:    { bg: "bg-[#eee4da]", text: "text-[#776e65]" },
  4:    { bg: "bg-[#ede0c8]", text: "text-[#776e65]" },
  8:    { bg: "bg-[#f2b179]", text: "text-white" },
  16:   { bg: "bg-[#f59563]", text: "text-white" },
  32:   { bg: "bg-[#f67c5f]", text: "text-white" },
  64:   { bg: "bg-[#f65e3b]", text: "text-white" },
  128:  { bg: "bg-[#edcf72]", text: "text-white" },
  256:  { bg: "bg-[#edcc61]", text: "text-white" },
  512:  { bg: "bg-[#edc850]", text: "text-white" },
  1024: { bg: "bg-[#edc53f]", text: "text-white" },
  2048: { bg: "bg-[#edc22e]", text: "text-white" },
  4096: { bg: "bg-[#3c3a32]", text: "text-white" },
  8192: { bg: "bg-[#3c3a32]", text: "text-white" },
};

function tileStyle(value: number) {
  return TILE_STYLES[value] ?? TILE_STYLES[8192];
}

function tileFontSize(value: number): string {
  if (value < 100) return "text-4xl sm:text-5xl";
  if (value < 1000) return "text-3xl sm:text-4xl";
  if (value < 10000) return "text-2xl sm:text-3xl";
  return "text-xl sm:text-2xl";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Game2048Page() {
  const { data: authSession, status: authStatus } = useSession();

  const [playerId, setPlayerId] = useState<string | null>(null);

  // Core game state
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keepPlayingAfterWin, setKeepPlayingAfterWin] = useState(false);

  // Best score persists across runs in localStorage while we wait for server.
  const [bestScore, setBestScore] = useState(0);

  // Leaderboard UI
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [lbScope, setLbScope] = useState<LeaderboardScope>("alltime");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // Track whether the current run has already been submitted so we don't
  // double-submit on every subsequent keypress after game over.
  const submittedRef = useRef(false);

  // ── Auth gate ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authStatus !== "loading" && !authSession) {
      signIn("google", { callbackUrl: "/2048" });
    }
  }, [authSession, authStatus]);

  // Register player (shared with other games — same WordlePlayer row)
  useEffect(() => {
    if (authStatus === "loading" || !authSession?.user?.email) return;
    const stored = localStorage.getItem("memory_player_id");
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
        } else if (stored) {
          setPlayerId(stored);
        }
      })
      .catch(() => {});
  }, [authSession, authStatus]);

  // Load best score from localStorage on mount.
  useEffect(() => {
    const stored = localStorage.getItem("game2048_best_score");
    if (stored) setBestScore(parseInt(stored, 10) || 0);
  }, []);

  // ── New game ─────────────────────────────────────────────────────────────
  const newGame = useCallback(() => {
    setBoard(createBoard());
    setScore(0);
    setMoves(0);
    setStartedAt(Date.now());
    setGameOver(false);
    setWon(false);
    setKeepPlayingAfterWin(false);
    submittedRef.current = false;
  }, []);

  // ── Submit finished run ──────────────────────────────────────────────────
  const submitRun = useCallback(
    (finalBoard: Board, finalScore: number, finalMoves: number) => {
      if (submittedRef.current) return;
      if (!playerId) return;
      if (finalMoves === 0) return; // nothing to submit

      submittedRef.current = true;
      const duration = Math.floor((Date.now() - startedAt) / 1000);
      const highestTile = getHighestTile(finalBoard);

      fetch("/api/2048/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          score: finalScore,
          highestTile,
          moves: finalMoves,
          duration,
        }),
      }).catch(() => {
        // Allow a retry if the network hiccups.
        submittedRef.current = false;
      });

      // Update best score locally.
      if (finalScore > bestScore) {
        setBestScore(finalScore);
        localStorage.setItem("game2048_best_score", String(finalScore));
      }
    },
    [playerId, startedAt, bestScore]
  );

  // ── Move handler ─────────────────────────────────────────────────────────
  const handleMove = useCallback(
    (dir: Direction) => {
      if (gameOver) return;
      if (won && !keepPlayingAfterWin) return;

      setBoard((prev) => {
        const { board: afterMove, gained, moved } = applyMove(prev, dir);
        if (!moved) return prev;

        // Spawn a new tile into the post-move board.
        spawnTile(afterMove);

        const newScore = score + gained;
        const newMoves = moves + 1;

        // Update derivatives in the same tick.
        setScore(newScore);
        setMoves(newMoves);

        // Check win (first time hitting 2048).
        if (!won && getHighestTile(afterMove) >= WIN_TILE) {
          setWon(true);
        }

        // Check game over.
        if (isGameOver(afterMove)) {
          setGameOver(true);
          submitRun(afterMove, newScore, newMoves);
        }

        return afterMove;
      });
    },
    [gameOver, won, keepPlayingAfterWin, score, moves, submitRun]
  );

  // ── Keyboard controls ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when a modal is up so its Escape handling works cleanly.
      if (showLeaderboard || showHelp) {
        if (e.key === "Escape") {
          setShowLeaderboard(false);
          setShowHelp(false);
        }
        return;
      }
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          handleMove("up");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          handleMove("down");
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          handleMove("left");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          handleMove("right");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleMove, showLeaderboard, showHelp]);

  // ── Touch / swipe controls ───────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 24; // px — ignore tiny drags
    touchStartRef.current = null;

    if (Math.max(absX, absY) < threshold) return;
    if (absX > absY) {
      handleMove(dx > 0 ? "right" : "left");
    } else {
      handleMove(dy > 0 ? "down" : "up");
    }
  };

  // ── Leaderboard fetch ────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await fetch(`/api/2048/leaderboard?scope=${lbScope}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch {
      // ignore
    } finally {
      setLbLoading(false);
    }
  }, [lbScope]);

  useEffect(() => {
    if (showLeaderboard) fetchLeaderboard();
  }, [showLeaderboard, fetchLeaderboard]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (authStatus === "loading" || !authSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Home"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-[#776e65] dark:text-gray-100">2048</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHelp(true)}
            className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            title="How to play"
            aria-label="How to play"
          >
            <Info size={20} />
          </button>
          <button
            onClick={() => setShowLeaderboard(true)}
            className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            title="Leaderboard"
            aria-label="Leaderboard"
          >
            <Trophy size={20} />
          </button>
        </div>
      </div>

      {/* Score cards */}
      <div className="flex items-stretch gap-3 mb-4">
        <div className="flex-1 bg-[#bbada0] dark:bg-gray-700 rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-[#eee4da] font-bold">
            Score
          </p>
          <p className="text-xl font-bold text-white">{score}</p>
        </div>
        <div className="flex-1 bg-[#bbada0] dark:bg-gray-700 rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-[#eee4da] font-bold">
            Best
          </p>
          <p className="text-xl font-bold text-white">{bestScore}</p>
        </div>
        <button
          onClick={newGame}
          className="px-3 rounded-lg bg-[#8f7a66] hover:bg-[#9f8a76] text-white font-semibold flex items-center gap-1.5"
        >
          <RotateCcw size={16} />
          New
        </button>
      </div>

      {/* Instructional hint */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-3">
        Combine matching tiles. Reach <strong>2048</strong>. Swipe or use arrow keys.
      </p>

      {/* Board */}
      <div
        className="relative bg-[#bbada0] dark:bg-gray-700 rounded-xl p-2 sm:p-3 mx-auto select-none touch-none"
        style={{ maxWidth: 420 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {board.flat().map((value, idx) => {
            const style = tileStyle(value);
            return (
              <div
                key={idx}
                className={clsx(
                  "aspect-square rounded-lg flex items-center justify-center font-bold",
                  style.bg,
                  style.text,
                  tileFontSize(value),
                  value > 0 && "shadow-sm"
                )}
              >
                {value > 0 ? value : ""}
              </div>
            );
          })}
        </div>

        {/* Win overlay */}
        {won && !keepPlayingAfterWin && !gameOver && (
          <div className="absolute inset-0 bg-yellow-400/85 rounded-xl flex flex-col items-center justify-center p-4">
            <Trophy size={48} className="text-white mb-2" />
            <p className="text-3xl font-bold text-white mb-1">You win!</p>
            <p className="text-white/90 mb-4 text-sm">
              {score} points in {moves} moves
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  submitRun(board, score, moves);
                  setKeepPlayingAfterWin(true);
                }}
                className="px-4 py-2 rounded-lg bg-white text-yellow-700 font-semibold hover:bg-yellow-50"
              >
                Keep Going
              </button>
              <button
                onClick={() => {
                  submitRun(board, score, moves);
                  newGame();
                }}
                className="px-4 py-2 rounded-lg bg-yellow-700 text-white font-semibold hover:bg-yellow-800"
              >
                New Game
              </button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-white/85 dark:bg-gray-900/85 rounded-xl flex flex-col items-center justify-center p-4">
            <p className="text-3xl font-bold text-[#776e65] dark:text-gray-100 mb-1">
              Game Over
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-1 text-sm">
              Score: <strong>{score}</strong> · Highest tile:{" "}
              <strong>{getHighestTile(board)}</strong>
            </p>
            <p className="text-gray-500 dark:text-gray-500 mb-4 text-xs">
              {moves} moves · {formatDuration(Math.floor((Date.now() - startedAt) / 1000))}
            </p>
            <button
              onClick={newGame}
              className="px-4 py-2 rounded-lg bg-[#8f7a66] text-white font-semibold hover:bg-[#9f8a76]"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Help modal */}
      {showHelp && (
        <Modal onClose={() => setShowHelp(false)} title="How to Play">
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>
              Use <strong>arrow keys</strong> on desktop or <strong>swipe</strong> on
              mobile to slide all tiles in one direction.
            </li>
            <li>
              When two tiles with the same number touch, they <strong>merge into one</strong>.
            </li>
            <li>
              Your goal is to create a tile showing <strong>2048</strong>. You can keep
              playing after you win to chase a higher score.
            </li>
            <li>
              The game ends when the board fills up and no more merges are possible.
            </li>
            <li>
              Your <strong>best score</strong> each week enters the community leaderboard.
            </li>
          </ul>
        </Modal>
      )}

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <Modal onClose={() => setShowLeaderboard(false)} title="Leaderboard">
          <div className="flex gap-2 mb-3">
            {(["alltime", "weekly"] as LeaderboardScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setLbScope(s)}
                className={clsx(
                  "flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  lbScope === s
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
              >
                {s === "alltime" ? "All-Time" : "This Week"}
              </button>
            ))}
          </div>

          {lbLoading ? (
            <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
              Loading…
            </p>
          ) : leaderboard.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
              No scores yet. Be the first!
            </p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {leaderboard.map((entry) => {
                const isMe = entry.playerId === playerId;
                return (
                  <div
                    key={entry.playerId}
                    className={clsx(
                      "flex items-center gap-3 p-2 rounded-lg",
                      isMe
                        ? "bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700"
                        : "bg-gray-50 dark:bg-gray-700/50"
                    )}
                  >
                    <span
                      className={clsx(
                        "w-7 text-center font-bold",
                        entry.rank === 1
                          ? "text-yellow-500"
                          : entry.rank === 2
                          ? "text-gray-400"
                          : entry.rank === 3
                          ? "text-amber-600"
                          : "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      {entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {entry.name}
                        {isMe && (
                          <span className="ml-1 text-xs text-primary-600 dark:text-primary-400">
                            (You)
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        Block {entry.block}
                        {entry.flatNumber ? `, ${entry.flatNumber}` : ""} · Best tile{" "}
                        {entry.highestTile}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                        {entry.score}
                      </p>
                      <p className="text-[9px] uppercase text-gray-400">points</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Modal helper ───────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
