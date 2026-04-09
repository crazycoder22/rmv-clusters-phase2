"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Trophy, Clock, Delete, Share2 } from "lucide-react";
import AdBanner from "@/components/ads/AdBanner";
import { formatTime, getPeerIndices, getErrorCells } from "@/lib/sudoku";
import { toPng } from "html-to-image";
import { useRole } from "@/hooks/useRole";
import type { Difficulty } from "@/lib/sudoku";

// ── Types ──────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  timeSeconds: number;
}

interface WeeklyLeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  totalPoints: number;
  totalTime: number;
  daysPlayed: number;
}

type LeaderboardScope = "daily" | "weekly";

// ── Registration form (same as Wordle, uses WordlePlayer) ──────────────────

function RegistrationForm({ onRegister }: { onRegister: (id: string, name: string) => void }) {
  const [name, setName] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/wordle/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, block: Number(block), flatNumber, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      localStorage.setItem("sudoku_player_id", data.playerId);
      localStorage.setItem("sudoku_player_name", data.name);
      onRegister(data.playerId, data.name);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Welcome to Sudoku!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter your details to start playing</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={block} onChange={(e) => setBlock(e.target.value)} placeholder="Block" required min={1} className={inputClass} />
            <input value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} placeholder="Flat Number" required className={inputClass} />
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className={inputClass} />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required className={inputClass} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 text-sm transition-colors">
            {saving ? "Registering..." : "Start Playing"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Grid ───────────────────────────────────────────────────────────────────

function getCellClass(
  idx: number,
  puzzle: number[],
  grid: number[],
  selected: number | null,
  peers: Set<number>,
  errors: Set<number>,
  completed: boolean,
): string {
  const row = Math.floor(idx / 9);
  const col = idx % 9;
  const isLocked = puzzle[idx] !== 0;

  // Border classes for 3×3 box separation
  let border = "border border-gray-300 dark:border-gray-600";
  if (col % 3 === 0) border += " border-l-2 border-l-gray-700 dark:border-l-gray-300";
  if (col === 8) border += " border-r-2 border-r-gray-700 dark:border-r-gray-300";
  if (row % 3 === 0) border += " border-t-2 border-t-gray-700 dark:border-t-gray-300";
  if (row === 8) border += " border-b-2 border-b-gray-700 dark:border-b-gray-300";

  // Background color
  let bg = "";
  if (completed) {
    bg = "bg-green-50 dark:bg-green-900/20";
  } else if (idx === selected) {
    bg = "bg-blue-500 dark:bg-blue-600 text-white";
  } else if (errors.has(idx)) {
    bg = "bg-red-100 dark:bg-red-900/30";
  } else if (peers.has(idx)) {
    bg = "bg-blue-50 dark:bg-blue-900/20";
  } else if (isLocked) {
    bg = "bg-gray-100 dark:bg-gray-700/60";
  } else {
    bg = "bg-white dark:bg-gray-800";
  }

  // Text color
  let text = "";
  if (idx === selected) {
    text = "text-white";
  } else if (errors.has(idx)) {
    text = "text-red-600 dark:text-red-400";
  } else if (isLocked) {
    text = "font-bold text-gray-800 dark:text-gray-100";
  } else if (grid[idx] !== 0) {
    text = "font-medium text-blue-700 dark:text-blue-300";
  } else {
    text = "text-gray-800 dark:text-gray-100";
  }

  return `${border} ${bg} ${text} flex items-center justify-center text-base sm:text-lg cursor-pointer select-none transition-colors aspect-square`;
}

function SudokuGrid({
  puzzle, grid, selected, completed, onCellClick,
}: {
  puzzle: number[];
  grid: number[];
  selected: number | null;
  completed: boolean;
  onCellClick: (idx: number) => void;
}) {
  const peers = selected !== null ? getPeerIndices(selected) : new Set<number>();
  const errors = getErrorCells(grid, puzzle);

  return (
    <div className="grid grid-cols-9 border-2 border-gray-700 dark:border-gray-300 w-full max-w-sm mx-auto">
      {grid.map((val, idx) => (
        <div
          key={idx}
          className={getCellClass(idx, puzzle, grid, selected, peers, errors, completed)}
          onClick={() => onCellClick(idx)}
        >
          {val !== 0 ? val : ""}
        </div>
      ))}
    </div>
  );
}

// ── Number Pad ─────────────────────────────────────────────────────────────

function NumberPad({ onNumber, onErase, disabled }: { onNumber: (n: number) => void; onErase: () => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid grid-cols-9 gap-1 w-full max-w-sm mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => onNumber(n)}
            disabled={disabled}
            className="aspect-square flex items-center justify-center text-base font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-400 disabled:opacity-40 transition-colors"
          >
            {n}
          </button>
        ))}
      </div>
      <button
        onClick={onErase}
        disabled={disabled}
        className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 hover:text-red-600 disabled:opacity-40 transition-colors"
      >
        <Delete size={15} />
        Erase
      </button>
    </div>
  );
}

// ── Leaderboard ────────────────────────────────────────────────────────────

function LeaderboardView({ currentPlayerId, difficulty, setDifficulty, isAdmin }: {
  currentPlayerId: string | null;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  isAdmin: boolean;
}) {
  const [scope, setScope] = useState<LeaderboardScope>("daily");
  const [dailyEntries, setDailyEntries] = useState<LeaderboardEntry[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyLeaderboardEntry[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (scope === "weekly") {
      fetch(`/api/sudoku/leaderboard?scope=weekly&difficulty=${difficulty}`)
        .then((r) => r.ok ? r.json() : { leaderboard: [], weekStart: "", weekEnd: "" })
        .then((d) => {
          setWeeklyEntries(d.leaderboard ?? []);
          if (d.weekStart && d.weekEnd) {
            const fmt = (s: string) => new Date(s + "T00:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            setWeekLabel(`${fmt(d.weekStart)} – ${fmt(d.weekEnd)}`);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/sudoku/leaderboard?difficulty=${difficulty}`)
        .then((r) => r.ok ? r.json() : { leaderboard: [] })
        .then((d) => setDailyEntries(d.leaderboard ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [difficulty, scope]);

  const diffBtnClass = (d: Difficulty) =>
    `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
      difficulty === d
        ? "bg-primary-600 dark:bg-primary-500 text-white border-primary-600"
        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary-400"
    }`;

  const scopeBtnClass = (s: LeaderboardScope) =>
    `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
      scope === s
        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    }`;

  const isEmpty = scope === "daily" ? dailyEntries.length === 0 : weeklyEntries.length === 0;

  const rankBadge = (rank: number) => {
    const color = rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-amber-700" : "text-gray-400 dark:text-gray-500";
    const label = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
    return <span className={`text-sm font-bold w-6 text-center ${color}`}>{label}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Scope toggle: Daily / Weekly */}
      <div className="flex justify-center">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button className={scopeBtnClass("daily")} onClick={() => setScope("daily")}>
            Today
          </button>
          <button className={scopeBtnClass("weekly")} onClick={() => setScope("weekly")}>
            Weekly Challenge
          </button>
        </div>
      </div>

      {/* Week label */}
      {scope === "weekly" && weekLabel && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 -mt-2">
          {weekLabel}
        </p>
      )}

      {/* Difficulty filter */}
      <div className="flex gap-2 justify-center">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button key={d} className={diffBtnClass(d)} onClick={() => setDifficulty(d)}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">Loading…</p>
      ) : isEmpty ? (
        <div className="text-center py-10">
          <Trophy size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {scope === "weekly" ? `No completions this week for ${difficulty}!` : `No completions yet for ${difficulty}!`}
          </p>
        </div>
      ) : scope === "daily" ? (
        /* ── Daily leaderboard ── */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-[auto_1fr_auto] gap-3 flex-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Time</span>
            </div>
            {isAdmin && (
              <a
                href="/api/sudoku/leaderboard?format=csv&all=true"
                className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline ml-2 shrink-0"
              >
                CSV
              </a>
            )}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {dailyEntries.map((e) => (
              <div
                key={e.playerId}
                className={`grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3 items-center ${e.playerId === currentPlayerId ? "bg-primary-50/50 dark:bg-primary-900/20" : ""}`}
              >
                {rankBadge(e.rank)}
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {e.name}
                    {e.playerId === currentPlayerId && <span className="ml-1.5 text-xs text-primary-600 dark:text-primary-400">(You)</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Block {e.block}, {e.flatNumber}</p>
                </div>
                <span className="text-sm font-mono font-semibold text-primary-600 dark:text-primary-400">
                  {formatTime(e.timeSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Weekly leaderboard ── */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 flex-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Days</span>
              <span className="text-right">Points</span>
            </div>
            {isAdmin && (
              <a
                href={`/api/sudoku/leaderboard?scope=weekly&format=csv&difficulty=${difficulty}`}
                className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline ml-2 shrink-0"
              >
                CSV
              </a>
            )}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {weeklyEntries.map((e) => (
              <div
                key={e.playerId}
                className={`grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-3 items-center ${e.playerId === currentPlayerId ? "bg-primary-50/50 dark:bg-primary-900/20" : ""}`}
              >
                {rankBadge(e.rank)}
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {e.name}
                    {e.playerId === currentPlayerId && <span className="ml-1.5 text-xs text-primary-600 dark:text-primary-400">(You)</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Block {e.block}, {e.flatNumber}
                    <span className="mx-1">·</span>
                    <span className="font-mono">{formatTime(e.totalTime)}</span> total
                  </p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums text-right">
                  {e.daysPlayed}/7
                </span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums text-right min-w-[2.5rem]">
                  {e.totalPoints} pts
                </span>
              </div>
            ))}
          </div>
          {/* Points legend */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
              Daily points: 1st=10 · 2nd=8 · 3rd=6 · 4th=5 · 5th=4 · 6th=3 · 7th=2 · 8th+=1
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Completion Banner with Screenshot Share ─────────────────────────────

function CompletionBanner({
  difficulty,
  savedTime,
  playerName,
  onLeaderboard,
  shareRef,
}: {
  difficulty: Difficulty;
  savedTime: number | null;
  playerName: string;
  onLeaderboard: () => void;
  shareRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [sharing, setSharing] = useState(false);

  const diffLabel = difficulty === "easy" ? "Easy" : difficulty === "medium" ? "Medium" : "Hard";
  const timeStr = formatTime(savedTime ?? 0);

  const handleShare = async () => {
    if (!shareRef.current || sharing) return;
    setSharing(true);

    try {
      // Show the branded header for screenshot
      const header = shareRef.current.querySelector("[data-share-header]") as HTMLElement | null;
      if (header) header.style.display = "block";

      // Capture screenshot
      const dataUrl = await toPng(shareRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        style: { padding: "16px" },
      });

      // Hide header again
      if (header) header.style.display = "none";

      // Convert to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "sudoku-result.png", { type: "image/png" });

      // Try Web Share API with file
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: `RMV Sudoku ${diffLabel} - ${timeStr}\nPlay at https://www.rmvclustersphase2.in/sudoku`,
        });
      } else {
        // Fallback: download the image
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "sudoku-result.png";
        link.click();
      }
    } catch {
      // Silent fail
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center space-y-3">
      <p className="text-green-700 dark:text-green-300 font-semibold text-lg">Puzzle Complete!</p>
      <p className="text-green-600 dark:text-green-400 text-sm">
        {diffLabel} · Time: <span className="font-mono font-bold">{timeStr}</span>
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Share2 size={15} />
          {sharing ? "Capturing..." : "Share Screenshot"}
        </button>
        <button
          onClick={onLeaderboard}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >
          See Leaderboard →
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: "easy",   label: "Easy",   color: "text-green-600 dark:text-green-400" },
  { value: "medium", label: "Medium", color: "text-yellow-600 dark:text-yellow-400" },
  { value: "hard",   label: "Hard",   color: "text-red-600 dark:text-red-400" },
];

export default function SudokuPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { isSuperAdmin } = useRole();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [tab, setTab] = useState<"game" | "leaderboard">("game");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [puzzle, setPuzzle] = useState<number[]>(Array(81).fill(0));
  const [grid, setGrid] = useState<number[]>(Array(81).fill(0));
  const [selected, setSelected] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [savedTime, setSavedTime] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameLoading, setGameLoading] = useState(false);

  // Timer
  const [timeSeconds, setTimeSeconds] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounce save ref
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Share screenshot ref
  const shareRef = useRef<HTMLDivElement>(null);

  // ── Auto-register ────────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (session?.user?.email) {
      fetch("/api/wordle/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromSession: true }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            localStorage.setItem("sudoku_player_id", data.playerId);
            localStorage.setItem("sudoku_player_name", data.name);
            setPlayerId(data.playerId);
            setPlayerName(data.name);
          }
        })
        .catch(() => {
          const storedId = localStorage.getItem("sudoku_player_id");
          if (storedId) { setPlayerId(storedId); setPlayerName(localStorage.getItem("sudoku_player_name") ?? ""); }
        })
        .finally(() => setLoading(false));
      return;
    }

    const storedId = localStorage.getItem("sudoku_player_id");
    if (storedId) { setPlayerId(storedId); setPlayerName(localStorage.getItem("sudoku_player_name") ?? ""); }
    setLoading(false);
  }, [session, sessionStatus]);

  // ── Load game ────────────────────────────────────────────────────────────

  const fetchGame = useCallback(async (pid: string, diff: Difficulty) => {
    setGameLoading(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/sudoku/game?playerId=${pid}&difficulty=${diff}`);
      if (!res.ok) {
        if (res.status === 404) {
          localStorage.removeItem("sudoku_player_id");
          localStorage.removeItem("sudoku_player_name");
          setPlayerId(null);
        }
        return;
      }
      const data = await res.json();
      setPuzzle(data.puzzle);
      setGrid(data.currentGrid);
      setCompleted(data.completed);
      setSavedTime(data.timeSeconds ?? null);
      setSubmitError(false);
      // Resume timer from saved time
      savedTimeOffset.current = data.timeSeconds ?? 0;
    } finally {
      setGameLoading(false);
    }
  }, []);

  useEffect(() => {
    if (playerId) fetchGame(playerId, difficulty);
  }, [playerId, difficulty, fetchGame]);

  // Track previously accumulated time from DB
  const savedTimeOffset = useRef<number>(0);

  // ── Timer — resumes from savedTimeOffset ─────────────────────────────────

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (completed || !playerId || gameLoading) return;

    startTimeRef.current = Date.now();
    // Show accumulated time immediately (offset loaded from DB)
    setTimeSeconds(savedTimeOffset.current);

    timerRef.current = setInterval(() => {
      const sessionSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTimeSeconds(savedTimeOffset.current + sessionSeconds);
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [completed, playerId, difficulty, gameLoading]);

  // Helper: get current total elapsed time
  const getElapsed = useCallback(() => {
    const sessionSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    return savedTimeOffset.current + sessionSeconds;
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────

  // Auto-save progress + elapsed time (debounced)
  const saveProgress = useCallback(async (newGrid: number[]) => {
    if (!playerId || completed) return;
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      await fetch("/api/sudoku/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, difficulty, currentGrid: newGrid, timeSeconds: getElapsed() }),
      });
    }, 800);
  }, [playerId, difficulty, completed, getElapsed]);

  // Submit for validation
  const handleSubmit = useCallback(async () => {
    if (!playerId || completed) return;
    const elapsed = getElapsed();
    const res = await fetch("/api/sudoku/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, difficulty, currentGrid: grid, timeSeconds: elapsed, action: "submit" }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.completed) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCompleted(true);
      setSavedTime(elapsed);
      setSubmitError(false);
    } else {
      setSubmitError(true);
    }
  }, [playerId, difficulty, grid, completed, getElapsed]);

  // Reset puzzle
  const handleReset = useCallback(async () => {
    if (!playerId) return;
    const res = await fetch("/api/sudoku/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, difficulty, action: "reset" }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setGrid(data.currentGrid);
    setCompleted(false);
    setSavedTime(null);
    setSubmitError(false);
    setSelected(null);
    // Reset timer to 0
    savedTimeOffset.current = 0;
    startTimeRef.current = Date.now();
    setTimeSeconds(0);
  }, [playerId, difficulty]);

  // ── Input handling ───────────────────────────────────────────────────────

  const handleCellClick = useCallback((idx: number) => {
    if (completed) return;
    setSelected(idx);
  }, [completed]);

  const handleNumber = useCallback((n: number) => {
    if (selected === null || completed) return;
    if (puzzle[selected] !== 0) return; // locked cell
    const newGrid = [...grid];
    newGrid[selected] = n;
    setGrid(newGrid);
    setSubmitError(false);
    saveProgress(newGrid);
  }, [selected, completed, puzzle, grid, saveProgress]);

  const handleErase = useCallback(() => {
    if (selected === null || completed) return;
    if (puzzle[selected] !== 0) return;
    const newGrid = [...grid];
    newGrid[selected] = 0;
    setGrid(newGrid);
    setSubmitError(false);
    saveProgress(newGrid);
  }, [selected, completed, puzzle, grid, saveProgress]);

  // Physical keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (/^[1-9]$/.test(e.key)) handleNumber(parseInt(e.key));
      if (e.key === "Backspace" || e.key === "Delete") handleErase();
      // Arrow key navigation
      if (selected !== null) {
        const row = Math.floor(selected / 9);
        const col = selected % 9;
        if (e.key === "ArrowUp" && row > 0) setSelected(selected - 9);
        if (e.key === "ArrowDown" && row < 8) setSelected(selected + 9);
        if (e.key === "ArrowLeft" && col > 0) setSelected(selected - 1);
        if (e.key === "ArrowRight" && col < 8) setSelected(selected + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNumber, handleErase, selected]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading…</p></div>;
  }

  const diffBtnClass = (d: Difficulty) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
      difficulty === d
        ? "bg-primary-600 dark:bg-primary-500 text-white border-primary-600"
        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary-400"
    }`;

  const tabBtnClass = (t: "game" | "leaderboard") =>
    `flex-1 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      tab === t
        ? "border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400"
        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
    }`;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Sudoku</h1>
        <button onClick={() => setTab("leaderboard")} className="text-primary-600 hover:text-primary-700 dark:text-primary-400" title="Leaderboard">
          <Trophy size={20} />
        </button>
      </div>

      <AdBanner page="sudoku" placement="top" />

      {!playerId ? (
        <RegistrationForm onRegister={(id, name) => { setPlayerId(id); setPlayerName(name); }} />
      ) : (
        <div className="space-y-4">
          {/* Player info */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Playing as <span className="font-medium text-gray-700 dark:text-gray-300">{playerName}</span>
            </p>
            <button
              onClick={() => {
                localStorage.removeItem("sudoku_player_id");
                localStorage.removeItem("sudoku_player_name");
                setPlayerId(null); setPlayerName("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Switch player
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button className={tabBtnClass("game")} onClick={() => setTab("game")}>Game</button>
            <button className={tabBtnClass("leaderboard")} onClick={() => setTab("leaderboard")}>Leaderboard</button>
          </div>

          {tab === "game" ? (
            <div className="space-y-4">
              {/* Difficulty */}
              <div className="flex gap-2 justify-center">
                {DIFFICULTIES.map(({ value, label }) => (
                  <button key={value} className={diffBtnClass(value)} onClick={() => { setDifficulty(value); }}>
                    {label}
                  </button>
                ))}
              </div>

              {gameLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Timer */}
                  {!completed && (
                    <div className="flex items-center justify-center gap-1.5 text-gray-500 dark:text-gray-400">
                      <Clock size={15} />
                      <span className="font-mono text-sm">{formatTime(timeSeconds)}</span>
                    </div>
                  )}

                  {/* Grid (wrapped for screenshot share) */}
                  <div ref={shareRef}>
                    {/* Branded header — hidden normally, shown during screenshot capture */}
                    <div data-share-header="" style={{ display: "none" }} className="text-center pb-3">
                      <p className="text-lg font-bold text-gray-800">RMV Sudoku</p>
                      <p className="text-sm text-gray-500">
                        {DIFFICULTIES.find(d => d.value === difficulty)?.label} · Time: {formatTime(savedTime ?? timeSeconds)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">rmvclustersphase2.in/sudoku</p>
                    </div>
                    <SudokuGrid
                      puzzle={puzzle}
                      grid={grid}
                      selected={selected}
                      completed={completed}
                      onCellClick={handleCellClick}
                    />
                  </div>

                  {/* Completed banner */}
                  {completed ? (
                    <CompletionBanner
                      difficulty={difficulty}
                      savedTime={savedTime}
                      playerName={playerName}
                      onLeaderboard={() => setTab("leaderboard")}
                      shareRef={shareRef}
                    />
                  ) : (
                    <>
                      <NumberPad onNumber={handleNumber} onErase={handleErase} disabled={completed} />

                      {/* Submit + Reset */}
                      <div className="flex items-center justify-center gap-3 mt-2">
                        <button
                          onClick={handleSubmit}
                          disabled={grid.some((v) => v === 0)}
                          className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Reset puzzle? All your progress will be cleared and the timer will restart.")) {
                              handleReset();
                            }
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Reset
                        </button>
                      </div>

                      {submitError && (
                        <p className="text-center text-sm text-red-600 dark:text-red-400 mt-2">
                          Not quite right — some cells have errors. Check rows, columns, and boxes for duplicates.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <LeaderboardView
              currentPlayerId={playerId}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              isAdmin={isSuperAdmin()}
            />
          )}
        </div>
      )}

      <AdBanner page="sudoku" placement="bottom" />
    </div>
  );
}
