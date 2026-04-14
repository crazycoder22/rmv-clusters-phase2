"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Trophy, Share2, RotateCcw, Star, Clock, Layers, Users } from "lucide-react";
import clsx from "clsx";
import AdBanner from "@/components/ads/AdBanner";

// ── Types ──────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";
type LeaderboardScope = "daily" | "weekly";

interface CardState {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  moves: number;
  timeSeconds: number;
  score: number;
}

interface WeeklyLeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  totalPoints: number;
  totalScore: number;
  totalTime: number;
  daysPlayed: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<Difficulty, { cols: number; rows: number; pairs: number; label: string }> = {
  easy:   { cols: 4, rows: 3, pairs: 6,  label: "Easy" },
  medium: { cols: 4, rows: 4, pairs: 8,  label: "Medium" },
  hard:   { cols: 5, rows: 4, pairs: 10, label: "Hard" },
};

const STAR_THRESHOLDS: Record<Difficulty, [number, number]> = {
  easy:   [10, 16],   // <=10 moves = 3 stars, <=16 = 2 stars, else 1
  medium: [14, 22],
  hard:   [18, 28],
};

const FLIP_DELAY = 800;
const FLIP_DURATION = 300;

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getStars(difficulty: Difficulty, moves: number): number {
  const [three, two] = STAR_THRESHOLDS[difficulty];
  if (moves <= three) return 3;
  if (moves <= two) return 2;
  return 1;
}

// ── Card Component ─────────────────────────────────────────────────────────

function MemoryCard({
  card,
  onClick,
  disabled,
  size,
}: {
  card: CardState;
  onClick: () => void;
  disabled: boolean;
  size: string;
}) {
  const isRevealed = card.flipped || card.matched;

  return (
    <div
      className={clsx("perspective-500 cursor-pointer", size)}
      onClick={() => {
        if (!disabled && !card.matched && !card.flipped) onClick();
      }}
    >
      <div
        className={clsx(
          "relative w-full h-full transition-transform duration-300",
          "transform-style-3d",
          isRevealed && "rotate-y-180"
        )}
        style={{
          transformStyle: "preserve-3d",
          transition: `transform ${FLIP_DURATION}ms ease-in-out`,
          transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front (face-down) */}
        <div
          className={clsx(
            "absolute inset-0 rounded-xl flex items-center justify-center",
            "backface-hidden border-2 transition-all duration-200",
            "bg-gradient-to-br from-primary-500 to-primary-700",
            "dark:from-primary-600 dark:to-primary-800",
            "border-primary-400 dark:border-primary-500",
            "hover:scale-105 hover:shadow-lg hover:shadow-primary-500/20",
            "active:scale-95",
            disabled && "hover:scale-100 hover:shadow-none"
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <Star className="text-white/60" size={28} />
        </div>

        {/* Back (face-up) */}
        <div
          className={clsx(
            "absolute inset-0 rounded-xl flex items-center justify-center",
            "backface-hidden border-2 transition-all duration-200",
            card.matched
              ? "bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-500 shadow-md shadow-green-500/20 scale-105"
              : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600",
          )}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <span className="text-3xl sm:text-4xl select-none" role="img">
            {card.emoji}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard ────────────────────────────────────────────────────────────

function LeaderboardView({
  currentPlayerId,
  difficulty,
  setDifficulty,
}: {
  currentPlayerId: string | null;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
}) {
  const [scope, setScope] = useState<LeaderboardScope>("daily");
  const [dailyEntries, setDailyEntries] = useState<LeaderboardEntry[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyLeaderboardEntry[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url =
      scope === "weekly"
        ? `/api/memory/leaderboard?scope=weekly&difficulty=${difficulty}`
        : `/api/memory/leaderboard?difficulty=${difficulty}&scope=daily`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : { leaderboard: [] }))
      .then((d) => {
        if (scope === "weekly") {
          setWeeklyEntries(d.leaderboard ?? []);
          if (d.weekStart && d.weekEnd) {
            const fmt = (s: string) =>
              new Date(s + "T00:00:00+05:30").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              });
            setWeekLabel(`${fmt(d.weekStart)} – ${fmt(d.weekEnd)}`);
          }
        } else {
          setDailyEntries(d.leaderboard ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [difficulty, scope]);

  const diffBtnClass = (d: Difficulty) =>
    clsx(
      "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
      difficulty === d
        ? "bg-primary-600 dark:bg-primary-500 text-white border-primary-600"
        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary-400"
    );

  const scopeBtnClass = (s: LeaderboardScope) =>
    clsx(
      "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
      scope === s
        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    );

  const rankBadge = (rank: number) => {
    const label = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
    return <span className="text-sm font-bold w-6 text-center">{label}</span>;
  };

  const isEmpty = scope === "daily" ? dailyEntries.length === 0 : weeklyEntries.length === 0;

  return (
    <div className="space-y-4">
      {/* Scope toggle */}
      <div className="flex justify-center">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button className={scopeBtnClass("daily")} onClick={() => setScope("daily")}>
            Today
          </button>
          <button className={scopeBtnClass("weekly")} onClick={() => setScope("weekly")}>
            Weekly
          </button>
        </div>
      </div>

      {scope === "weekly" && weekLabel && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 -mt-2">{weekLabel}</p>
      )}

      {/* Difficulty filter */}
      <div className="flex gap-2 justify-center">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button key={d} className={diffBtnClass(d)} onClick={() => setDifficulty(d)}>
            {DIFFICULTY_CONFIG[d].label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">Loading...</p>
      ) : isEmpty ? (
        <div className="text-center py-10">
          <Trophy size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {scope === "weekly"
              ? `No completions this week for ${difficulty}!`
              : `No completions yet for ${difficulty}!`}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Be the first to complete it!</p>
        </div>
      ) : scope === "daily" ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Score</span>
              <span className="text-right">Moves</span>
              <span className="text-right">Time</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {dailyEntries.map((e) => (
              <div
                key={e.playerId}
                className={clsx(
                  "grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center",
                  e.playerId === currentPlayerId && "bg-primary-50/50 dark:bg-primary-900/20"
                )}
              >
                {rankBadge(e.rank)}
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {e.name}
                    {e.playerId === currentPlayerId && (
                      <span className="ml-1.5 text-xs text-primary-600 dark:text-primary-400">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Block {e.block}{e.flatNumber ? `, ${e.flatNumber}` : ""}
                  </p>
                </div>
                <span className="text-sm font-mono font-bold text-green-600 dark:text-green-400 text-right">
                  {e.score}
                </span>
                <span className="text-sm font-mono font-semibold text-gray-700 dark:text-gray-300 text-right">
                  {e.moves}
                </span>
                <span className="text-sm font-mono font-semibold text-primary-600 dark:text-primary-400 text-right">
                  {formatTime(e.timeSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Points</span>
              <span className="text-right">Days</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {weeklyEntries.map((e) => (
              <div
                key={e.playerId}
                className={clsx(
                  "grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-3 items-center",
                  e.playerId === currentPlayerId && "bg-primary-50/50 dark:bg-primary-900/20"
                )}
              >
                {rankBadge(e.rank)}
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {e.name}
                    {e.playerId === currentPlayerId && (
                      <span className="ml-1.5 text-xs text-primary-600 dark:text-primary-400">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Block {e.block}{e.flatNumber ? `, ${e.flatNumber}` : ""}
                  </p>
                </div>
                <span className="text-sm font-mono font-bold text-green-600 dark:text-green-400 text-right">
                  {e.totalScore ?? e.totalPoints}
                </span>
                <span className="text-sm font-mono text-gray-500 dark:text-gray-400 text-right">
                  {e.daysPlayed}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const { data: session, status: sessionStatus } = useSession();

  // Player state
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(true);

  // Game state
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [cards, setCards] = useState<CardState[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [bestToday, setBestToday] = useState<{ moves: number; time: number } | null>(null);
  const [lockBoard, setLockBoard] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<"game" | "leaderboard">("game");
  const [message, setMessage] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (sessionStatus !== "loading" && !session) {
      signIn("google", { callbackUrl: "/memory" });
    }
  }, [session, sessionStatus]);

  // Auto-register
  useEffect(() => {
    if (sessionStatus === "loading" || !session?.user?.email) return;

    const storedId =
      localStorage.getItem("memory_player_id") ||
      localStorage.getItem("wordle_player_id") ||
      localStorage.getItem("sudoku_player_id");
    const storedName =
      localStorage.getItem("memory_player_name") ||
      localStorage.getItem("wordle_player_name") ||
      localStorage.getItem("sudoku_player_name");

    fetch("/api/wordle/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSession: true }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          localStorage.setItem("memory_player_id", data.playerId);
          localStorage.setItem("memory_player_name", data.name);
          setPlayerId(data.playerId);
          setPlayerName(data.name);
        } else if (storedId) {
          setPlayerId(storedId);
          setPlayerName(storedName || "");
        }
      })
      .catch(() => {
        if (storedId) {
          setPlayerId(storedId);
          setPlayerName(storedName || "");
        }
      })
      .finally(() => setLoading(false));
  }, [session, sessionStatus]);

  // Fetch game state
  const fetchGame = useCallback(
    (diff: Difficulty) => {
      if (!playerId) return;
      setGameLoading(true);
      fetch(`/api/memory/game?playerId=${playerId}&difficulty=${diff}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;

          const emojis: string[] = data.cards || [];
          const newCards: CardState[] = emojis.map((emoji, i) => ({
            id: i,
            emoji,
            flipped: false,
            matched: !!data.completed,
          }));
          setCards(newCards);
          setMoves(data.moves || 0);
          setTimeSeconds(data.timeSeconds || 0);
          setCompleted(!!data.completed);
          setFlippedIndices([]);
          setLockBoard(!!data.completed);

          if (data.completed) {
            setTimerActive(false);
            setBestToday({ moves: data.moves, time: data.timeSeconds });
          } else {
            setBestToday(null);
            setTimerActive(false);
          }
        })
        .catch(() => {})
        .finally(() => setGameLoading(false));
    },
    [playerId]
  );

  useEffect(() => {
    if (playerId) fetchGame(difficulty);
  }, [playerId, difficulty, fetchGame]);

  // Timer
  useEffect(() => {
    if (timerActive && !completed) {
      timerRef.current = setInterval(() => {
        setTimeSeconds((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, completed]);

  // Submit completion
  const submitCompletion = useCallback(
    (finalMoves: number, finalTime: number) => {
      if (!playerId) return;
      fetch("/api/memory/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          difficulty,
          moves: finalMoves,
          timeSeconds: finalTime,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(() => {
          setBestToday({ moves: finalMoves, time: finalTime });
        })
        .catch(() => {});
    },
    [playerId, difficulty]
  );

  // Handle card flip
  const handleCardClick = useCallback(
    (index: number) => {
      if (lockBoard || completed || cards[index].matched || cards[index].flipped) return;

      // Start timer on first flip
      if (!timerActive && moves === 0 && flippedIndices.length === 0) {
        setTimerActive(true);
      }

      const newCards = [...cards];
      newCards[index] = { ...newCards[index], flipped: true };
      const newFlipped = [...flippedIndices, index];
      setCards(newCards);
      setFlippedIndices(newFlipped);

      if (newFlipped.length === 2) {
        const newMoves = moves + 1;
        setMoves(newMoves);
        setLockBoard(true);

        const [first, second] = newFlipped;
        if (newCards[first].emoji === newCards[second].emoji) {
          // Match found
          setTimeout(() => {
            setCards((prev) => {
              const updated = [...prev];
              updated[first] = { ...updated[first], matched: true, flipped: false };
              updated[second] = { ...updated[second], matched: true, flipped: false };

              // Check if all matched
              const allMatched = updated.every((c) => c.matched);
              if (allMatched) {
                setCompleted(true);
                setTimerActive(false);
                setTimeSeconds((currentTime) => {
                  submitCompletion(newMoves, currentTime);
                  return currentTime;
                });
              }
              return updated;
            });
            setFlippedIndices([]);
            setLockBoard(false);
          }, 400);
        } else {
          // No match — flip back
          setTimeout(() => {
            setCards((prev) => {
              const updated = [...prev];
              updated[first] = { ...updated[first], flipped: false };
              updated[second] = { ...updated[second], flipped: false };
              return updated;
            });
            setFlippedIndices([]);
            setLockBoard(false);
          }, FLIP_DELAY);
        }
      }
    },
    [cards, flippedIndices, lockBoard, completed, moves, timerActive, submitCompletion]
  );

  // New game (reset)
  const handleNewGame = () => {
    setTimerActive(false);
    setTimeSeconds(0);
    setMoves(0);
    setCompleted(false);
    setFlippedIndices([]);
    setLockBoard(false);
    fetchGame(difficulty);
  };

  // Difficulty change
  const handleDifficultyChange = (d: Difficulty) => {
    if (d === difficulty) return;
    setTimerActive(false);
    setTimeSeconds(0);
    setMoves(0);
    setCompleted(false);
    setFlippedIndices([]);
    setLockBoard(false);
    setDifficulty(d);
  };

  // Share result
  const handleShare = () => {
    const stars = getStars(difficulty, moves);
    const starStr = Array(stars).fill("\u2B50").join("");
    const text = `🧠 RMV Memory Match\n🃏 ${DIFFICULTY_CONFIG[difficulty].label} | ${moves} moves | ${formatTime(timeSeconds)}\n${starStr}`;

    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setMessage("Copied to clipboard!");
          setTimeout(() => setMessage(""), 2000);
        })
        .catch(() => {});
    }
  };

  // Show message helper
  const showToast = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (sessionStatus === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const config = DIFFICULTY_CONFIG[difficulty];
  const gridCols =
    difficulty === "easy"
      ? "grid-cols-4"
      : difficulty === "medium"
      ? "grid-cols-4"
      : "grid-cols-5";

  const cardSize =
    difficulty === "easy"
      ? "w-[72px] h-[72px] sm:w-[88px] sm:h-[88px]"
      : difficulty === "medium"
      ? "w-[68px] h-[68px] sm:w-[80px] sm:h-[80px]"
      : "w-[60px] h-[60px] sm:w-[72px] sm:h-[72px]";

  const stars = completed ? getStars(difficulty, moves) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Memory Match</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/memory/multi"
              className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              title="Multi-player"
            >
              <Users size={20} />
            </Link>
            <button
              onClick={() => setActiveTab(activeTab === "leaderboard" ? "game" : "leaderboard")}
              className={clsx(
                "transition-colors",
                activeTab === "leaderboard"
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              )}
              title="Leaderboard"
            >
              <Trophy size={20} />
            </button>
          </div>
        </div>

        <AdBanner page="memory" placement="top" />

        {/* Tabs */}
        <div className="flex justify-center mb-5">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              className={clsx(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "game"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
              onClick={() => setActiveTab("game")}
            >
              <span className="flex items-center gap-1.5">
                <Layers size={14} />
                Game
              </span>
            </button>
            <button
              className={clsx(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "leaderboard"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
              onClick={() => setActiveTab("leaderboard")}
            >
              <span className="flex items-center gap-1.5">
                <Trophy size={14} />
                Leaderboard
              </span>
            </button>
          </div>
        </div>

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <LeaderboardView
            currentPlayerId={playerId}
            difficulty={difficulty}
            setDifficulty={handleDifficultyChange}
          />
        )}

        {/* Game Tab */}
        {activeTab === "game" && (
          <>
            {!playerId ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-pulse text-gray-500 dark:text-gray-400">
                  Setting up your game...
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Player info */}
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Playing as{" "}
                    <span className="font-medium text-gray-700 dark:text-gray-300">{playerName}</span>
                  </p>
                </div>

                {/* Difficulty selector */}
                <div className="flex gap-2 justify-center">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => handleDifficultyChange(d)}
                      className={clsx(
                        "px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
                        difficulty === d
                          ? "bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500 shadow-sm"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400"
                      )}
                    >
                      {DIFFICULTY_CONFIG[d].label}
                    </button>
                  ))}
                </div>

                {/* Stats bar */}
                <div className="flex items-center justify-center gap-6">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Layers size={15} className="text-gray-400 dark:text-gray-500" />
                    <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                      {moves}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs">moves</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock size={15} className="text-gray-400 dark:text-gray-500" />
                    <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                      {formatTime(timeSeconds)}
                    </span>
                  </div>
                  {bestToday && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Trophy size={14} className="text-yellow-500" />
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {bestToday.moves}m / {formatTime(bestToday.time)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Toast message */}
                {message && (
                  <div className="text-center">
                    <span className="inline-block bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 px-4 py-2 rounded-lg text-sm font-medium">
                      {message}
                    </span>
                  </div>
                )}

                {/* Card Grid */}
                {gameLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading cards...</div>
                  </div>
                ) : (
                  <div className={clsx("grid gap-2 sm:gap-3 justify-center mx-auto", gridCols)}
                    style={{ maxWidth: config.cols * (difficulty === "hard" ? 80 : 92) + "px" }}
                  >
                    {cards.map((card, idx) => (
                      <MemoryCard
                        key={card.id}
                        card={card}
                        onClick={() => handleCardClick(idx)}
                        disabled={lockBoard || completed}
                        size={cardSize}
                      />
                    ))}
                  </div>
                )}

                {/* New Game button */}
                {!completed && cards.length > 0 && (
                  <div className="flex justify-center">
                    <button
                      onClick={handleNewGame}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <RotateCcw size={15} />
                      New Game
                    </button>
                  </div>
                )}

                {/* Completion overlay */}
                {completed && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center space-y-4 shadow-lg">
                    <div className="text-4xl">🎉</div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      Congratulations!
                    </h2>

                    {/* Stars */}
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3].map((i) => (
                        <Star
                          key={i}
                          size={32}
                          className={clsx(
                            "transition-all duration-300",
                            i <= stars
                              ? "text-yellow-400 fill-yellow-400 drop-shadow-sm"
                              : "text-gray-300 dark:text-gray-600"
                          )}
                          style={{
                            animationDelay: `${i * 150}ms`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="flex justify-center gap-6 text-sm">
                      <div>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{moves}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Moves</p>
                      </div>
                      <div className="w-px bg-gray-200 dark:bg-gray-700" />
                      <div>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                          {formatTime(timeSeconds)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
                      </div>
                      <div className="w-px bg-gray-200 dark:bg-gray-700" />
                      <div>
                        <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                          {config.pairs}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Optimal</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors w-full sm:w-auto justify-center"
                      >
                        <Share2 size={16} />
                        Share Result
                      </button>
                      <button
                        onClick={() => setActiveTab("leaderboard")}
                        className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors w-full sm:w-auto justify-center"
                      >
                        <Trophy size={16} />
                        Leaderboard
                      </button>
                    </div>

                    {/* Try other difficulties */}
                    <div className="pt-2">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Try another difficulty</p>
                      <div className="flex gap-2 justify-center">
                        {(["easy", "medium", "hard"] as Difficulty[]).filter((d) => d !== difficulty).map((d) => (
                          <button
                            key={d}
                            onClick={() => handleDifficultyChange(d)}
                            className="px-3 py-1 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          >
                            {DIFFICULTY_CONFIG[d].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      New cards at midnight IST
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <AdBanner page="memory" placement="bottom" />
      </div>
    </div>
  );
}
