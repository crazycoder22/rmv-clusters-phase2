"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Delete as DeleteIcon,
  Loader2,
  RotateCcw,
  Send,
  Trophy,
} from "lucide-react";
import clsx from "clsx";
import AdBanner from "@/components/ads/AdBanner";

type Tab = "game" | "leaderboard";

type GameState = {
  date: string;
  letters: string[];
  required: string;
  foundWords: string[];
  score: number;
  maxScore: number;
  rank: string;
  pct: number;
};

type Toast =
  | { kind: "success"; message: string; pangram?: boolean }
  | { kind: "error"; message: string };

const REASON_TEXT: Record<string, string> = {
  TOO_SHORT: "Too short — words must be at least 4 letters.",
  MISSING_REQUIRED: "Word must include the centre letter.",
  BAD_LETTER: "Word uses letters not in the puzzle.",
  NOT_A_WORD: "Not in our dictionary.",
  ALREADY_FOUND: "You've already found that.",
  BAD_REQUEST: "Something went wrong. Try again.",
};

export default function AnagramPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("game");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [bootLoading, setBootLoading] = useState(true);

  const [game, setGame] = useState<GameState | null>(null);
  const [input, setInput] = useState("");
  const [orderedLetters, setOrderedLetters] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auth gate
  useEffect(() => {
    if (status !== "loading" && !session) {
      signIn("google", { callbackUrl: "/anagram" });
    }
  }, [session, status]);

  // Auto-register / fetch playerId
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    fetch("/api/wordle/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSession: true }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setPlayerId(data.playerId);
          setPlayerName(data.name);
        }
      })
      .finally(() => setBootLoading(false));
  }, [session, status]);

  // Fetch game
  const refresh = useCallback(async () => {
    if (!playerId) return;
    const res = await fetch(`/api/anagram/game?playerId=${playerId}`);
    if (!res.ok) return;
    const data = (await res.json()) as GameState;
    setGame(data);
    setOrderedLetters((prev) => {
      // First load: spread outer letters, keep required centred.
      if (prev.length === 7) return prev;
      const outer = data.letters.filter((l) => l !== data.required);
      return arrangeLetters(data.required, outer);
    });
  }, [playerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Hardware keyboard
  useEffect(() => {
    if (tab !== "game") return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void submitWord();
      } else if (e.key === "Backspace") {
        setInput((s) => s.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const c = e.key.toLowerCase();
        if (game?.letters.includes(c)) {
          setInput((s) => s + c);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, game]);

  const submitWord = useCallback(async () => {
    if (!playerId || !input.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/anagram/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, word: input.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setGame((g) =>
          g
            ? {
                ...g,
                foundWords: data.foundWords,
                score: data.runScore,
                rank: data.rank,
                pct: data.pct,
                maxScore: data.maxScore,
              }
            : g
        );
        setToast({
          kind: "success",
          message: data.isPangram
            ? `🌟 Pangram! +${data.score}`
            : `+${data.score}`,
          pangram: data.isPangram,
        });
        setInput("");
      } else {
        setToast({
          kind: "error",
          message: REASON_TEXT[data.reason] ?? data.reason ?? "Invalid",
        });
      }
    } finally {
      setSubmitting(false);
      window.setTimeout(() => setToast(null), 1800);
    }
  }, [playerId, input, submitting]);

  const shuffle = () => {
    if (!game) return;
    const outer = game.letters.filter((l) => l !== game.required);
    setOrderedLetters(arrangeLetters(game.required, shuffleArray(outer)));
  };

  if (status === "loading" || bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!playerId || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">Setting up…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Anagram
          </h1>
          <button
            onClick={() => setTab(tab === "leaderboard" ? "game" : "leaderboard")}
            className={clsx(
              "transition-colors",
              tab === "leaderboard"
                ? "text-amber-500"
                : "text-gray-400 hover:text-amber-500"
            )}
            title="Leaderboard"
          >
            <Trophy size={20} />
          </button>
        </div>

        <AdBanner page="anagram" placement="top" />

        {tab === "game" ? (
          <GameView
            game={game}
            orderedLetters={orderedLetters}
            input={input}
            setInput={setInput}
            onLetter={(l) => setInput((s) => s + l)}
            onDelete={() => setInput((s) => s.slice(0, -1))}
            onShuffle={shuffle}
            onSubmit={submitWord}
            submitting={submitting}
            toast={toast}
            playerName={playerName}
          />
        ) : (
          <LeaderboardView currentPlayerId={playerId} />
        )}
      </div>
    </div>
  );
}

function GameView({
  game,
  orderedLetters,
  input,
  setInput,
  onLetter,
  onDelete,
  onShuffle,
  onSubmit,
  submitting,
  toast,
  playerName,
}: {
  game: GameState;
  orderedLetters: string[];
  input: string;
  setInput: (s: string) => void;
  onLetter: (l: string) => void;
  onDelete: () => void;
  onShuffle: () => void;
  onSubmit: () => void;
  submitting: boolean;
  toast: Toast | null;
  playerName: string;
}) {
  const sorted = useMemo(() => [...game.foundWords].sort(), [game.foundWords]);
  const isPangram = (w: string) => game.letters.every((l) => w.includes(l));

  return (
    <div className="space-y-5">
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Playing as{" "}
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {playerName}
        </span>
      </div>

      {/* Score chip */}
      <div className="flex items-center justify-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5">
          <Crown size={14} className="text-amber-500" />
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {game.rank}
          </span>
          <span className="text-xs text-amber-600/70 dark:text-amber-400/70">
            · {game.score}/{game.maxScore} ({game.pct}%)
          </span>
        </div>
      </div>

      {/* Input */}
      <div className="relative">
        <div
          className={clsx(
            "h-14 rounded-xl border-2 bg-white dark:bg-gray-800 flex items-center justify-center text-2xl font-bold uppercase tracking-widest transition-colors",
            input.length === 0
              ? "border-gray-200 dark:border-gray-700 text-gray-300"
              : "border-primary-400 text-gray-800 dark:text-gray-100"
          )}
        >
          {input || "type a word…"}
        </div>
        {toast && (
          <div
            className={clsx(
              "absolute left-1/2 -translate-x-1/2 -top-3 text-xs font-bold px-3 py-1 rounded-full shadow",
              toast.kind === "success"
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            )}
          >
            {toast.message}
          </div>
        )}
      </div>

      {/* Letter hex (2-3-2 layout) */}
      <div className="mx-auto grid grid-cols-3 gap-2 max-w-[220px]">
        {/* Row 1: outer-0, outer-1, blank */}
        <LetterCell letter={orderedLetters[0]} onClick={onLetter} />
        <LetterCell letter={orderedLetters[1]} onClick={onLetter} />
        <span />
        {/* Row 2: outer-2, REQUIRED, outer-3 */}
        <LetterCell letter={orderedLetters[2]} onClick={onLetter} />
        <LetterCell
          letter={game.required}
          onClick={onLetter}
          required
        />
        <LetterCell letter={orderedLetters[3]} onClick={onLetter} />
        {/* Row 3: blank, outer-4, outer-5 */}
        <span />
        <LetterCell letter={orderedLetters[4]} onClick={onLetter} />
        <LetterCell letter={orderedLetters[5]} onClick={onLetter} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onDelete}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1.5"
        >
          <DeleteIcon size={14} />
          Delete
        </button>
        <button
          onClick={onShuffle}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1.5"
        >
          <RotateCcw size={14} />
          Shuffle
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting || input.length < 1}
          className="px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Enter
        </button>
      </div>

      {/* Found words */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          You've found {sorted.length}{" "}
          {sorted.length === 1 ? "word" : "words"}
        </p>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No words yet. The required letter appears in every valid word.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((w) => {
              const p = isPangram(w);
              return (
                <span
                  key={w}
                  className={clsx(
                    "inline-block px-2 py-0.5 rounded text-sm",
                    p
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  )}
                >
                  {w}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        New letters daily at midnight IST · pangrams (using all 7 letters)
        give a +7 bonus
      </p>
    </div>
  );
}

function LetterCell({
  letter,
  onClick,
  required,
}: {
  letter: string;
  onClick: (l: string) => void;
  required?: boolean;
}) {
  if (!letter) return <span />;
  return (
    <button
      onClick={() => onClick(letter)}
      className={clsx(
        "h-16 rounded-xl text-2xl font-extrabold uppercase transition-transform active:scale-95",
        required
          ? "bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-md shadow-amber-500/30"
          : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
      )}
    >
      {letter}
    </button>
  );
}

type DailyEntry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  score: number;
  wordsFound: number;
};

type WeeklyEntry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  totalScore: number;
  daysPlayed: number;
};

function LeaderboardView({
  currentPlayerId,
}: {
  currentPlayerId: string | null;
}) {
  const [scope, setScope] = useState<"daily" | "weekly">("daily");
  const [daily, setDaily] = useState<DailyEntry[]>([]);
  const [weekly, setWeekly] = useState<WeeklyEntry[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/anagram/leaderboard?scope=${scope}`)
      .then((r) => (r.ok ? r.json() : { leaderboard: [] }))
      .then((d) => {
        if (scope === "weekly") {
          setWeekly(d.leaderboard ?? []);
          if (d.weekStart && d.weekEnd) {
            const fmt = (s: string) =>
              new Date(s + "T00:00:00+05:30").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              });
            setWeekLabel(`${fmt(d.weekStart)} – ${fmt(d.weekEnd)}`);
          }
        } else {
          setDaily(d.leaderboard ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scope]);

  const empty =
    scope === "daily" ? daily.length === 0 : weekly.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setScope("daily")}
            className={clsx(
              "px-3 py-1.5 rounded-md text-xs font-medium",
              scope === "daily"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            )}
          >
            Today
          </button>
          <button
            onClick={() => setScope("weekly")}
            className={clsx(
              "px-3 py-1.5 rounded-md text-xs font-medium",
              scope === "weekly"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            )}
          >
            Weekly
          </button>
        </div>
      </div>

      {scope === "weekly" && weekLabel && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 -mt-2">
          {weekLabel}
        </p>
      )}

      {loading ? (
        <p className="text-center text-sm text-gray-400 py-6">Loading…</p>
      ) : empty ? (
        <p className="text-center text-sm text-gray-400 py-10">
          No scores yet. Be the first!
        </p>
      ) : scope === "daily" ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {daily.map((e) => {
            const badge =
              e.rank === 1
                ? "🥇"
                : e.rank === 2
                  ? "🥈"
                  : e.rank === 3
                    ? "🥉"
                    : String(e.rank);
            return (
              <div
                key={e.playerId}
                className={clsx(
                  "grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-3 items-center border-b border-gray-100 dark:border-gray-700 last:border-0",
                  e.playerId === currentPlayerId &&
                    "bg-primary-50/50 dark:bg-primary-900/20"
                )}
              >
                <span className="w-6 text-center font-bold">{badge}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {e.name}
                    {e.playerId === currentPlayerId && (
                      <span className="ml-1.5 text-xs text-primary-600">
                        (You)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    Block {e.block}, {e.flatNumber}
                  </p>
                </div>
                <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">
                  {e.score}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {e.wordsFound}w
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {weekly.map((e) => {
            const badge =
              e.rank === 1
                ? "🥇"
                : e.rank === 2
                  ? "🥈"
                  : e.rank === 3
                    ? "🥉"
                    : String(e.rank);
            return (
              <div
                key={e.playerId}
                className={clsx(
                  "grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-3 items-center border-b border-gray-100 dark:border-gray-700 last:border-0",
                  e.playerId === currentPlayerId &&
                    "bg-primary-50/50 dark:bg-primary-900/20"
                )}
              >
                <span className="w-6 text-center font-bold">{badge}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {e.name}
                    {e.playerId === currentPlayerId && (
                      <span className="ml-1.5 text-xs text-primary-600">
                        (You)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    Block {e.block}, {e.flatNumber}
                  </p>
                </div>
                <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">
                  {e.totalScore}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {e.daysPlayed}d
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function arrangeLetters(_required: string, outer: string[]): string[] {
  // We always render the required letter in the centre slot of the 3×3
  // hex layout. The outer array is the 6 surrounding cells in display order.
  // First time this runs we pad up to 6.
  void _required;
  const next = [...outer];
  while (next.length < 6) next.push("");
  return next.slice(0, 6);
}
