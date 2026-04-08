"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import clsx from "clsx";
import {
  ArrowLeft,
  Dices,
  Copy,
  Check,
  Share2,
  Users,
  Trophy,
  Clock,
  CircleOff,
  Hash,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Prize {
  prizeType: string;
  playerName: string;
  claimedAt: string;
}

interface GameState {
  id: string;
  code: string;
  title: string;
  status: string;
  drawnNumbers: number[];
  prizes: Prize[];
  playerCount: number;
  updatedAt: string;
}

const PRIZE_LABELS: Record<string, string> = {
  EARLY_FIVE: "Early Five",
  TOP_LINE: "Top Line",
  MIDDLE_LINE: "Middle Line",
  BOTTOM_LINE: "Bottom Line",
  FULL_HOUSE: "Full House",
};

const PRIZE_ORDER = [
  "EARLY_FIVE",
  "TOP_LINE",
  "MIDDLE_LINE",
  "BOTTOM_LINE",
  "FULL_HOUSE",
];

const STATUS_STYLE: Record<string, string> = {
  WAITING:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  ACTIVE:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  COMPLETED:
    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminTambolaHostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { canManageAnnouncements, isLoading: roleLoading } = useRole();
  const router = useRouter();

  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [lastDrawn, setLastDrawn] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth guard
  useEffect(() => {
    if (!roleLoading && !canManageAnnouncements()) router.replace("/");
  }, [roleLoading, canManageAnnouncements, router]);

  // Fetch game state
  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/tambola/sessions/${code}`);
      if (!res.ok) return;
      const data: GameState = await res.json();
      setGame(data);
      if (data.drawnNumbers.length > 0) {
        setLastDrawn(data.drawnNumbers[data.drawnNumbers.length - 1]);
      }
    } catch {
      // silently ignore polling errors
    }
  }, [code]);

  // Initial load
  useEffect(() => {
    fetchGame().then(() => setLoading(false));
  }, [fetchGame]);

  // Poll every 2 seconds
  useEffect(() => {
    pollRef.current = setInterval(fetchGame, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchGame]);

  // Draw next number
  async function handleDraw() {
    setError("");
    setDrawing(true);
    try {
      const res = await fetch(`/api/tambola/sessions/${code}/draw`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to draw.");
        return;
      }
      setLastDrawn(data.drawnNumber);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 1500);
      // Immediately update local state
      setGame((prev) =>
        prev
          ? {
              ...prev,
              drawnNumbers: data.drawnNumbers,
              status: prev.status === "WAITING" ? "ACTIVE" : prev.status,
            }
          : prev
      );
    } finally {
      setDrawing(false);
    }
  }

  // End game
  async function handleEnd() {
    if (!confirm("Are you sure you want to end this game?")) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/tambola/sessions/${code}/end`, {
        method: "POST",
      });
      if (res.ok) {
        setGame((prev) =>
          prev ? { ...prev, status: "COMPLETED" } : prev
        );
      }
    } finally {
      setEnding(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const msg = `Join Tambola! Go to https://www.rmvclustersphase2.in/tambola and enter code: ${code}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }

  if (roleLoading || loading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Game not found.
      </div>
    );
  }

  const drawnSet = new Set(game.drawnNumbers);
  const isCompleted = game.status === "COMPLETED";
  const claimedPrizes = new Map(
    game.prizes.map((p) => [p.prizeType, p])
  );

  return (
    <div className="py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <Link
          href="/admin/tambola"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> Back to games
        </Link>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Dices
                  size={20}
                  className="text-purple-600 dark:text-purple-400"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {game.title}
                </h1>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded">
                    {game.code}
                  </span>
                  <span
                    className={clsx(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      STATUS_STYLE[game.status] ?? STATUS_STYLE.WAITING
                    )}
                  >
                    {game.status}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Users size={13} />
                    {game.playerCount} players
                  </span>
                </div>
              </div>
            </div>

            {/* Share buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy Code"}
              </button>
              <button
                onClick={shareWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Share2 size={14} />
                WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* ── Draw Section ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6 text-center">
          {/* Last drawn ball */}
          {lastDrawn !== null && (
            <div className="mb-5">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Last Drawn
              </p>
              <div
                className={clsx(
                  "inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 dark:from-purple-400 dark:to-purple-600 text-white text-4xl font-bold shadow-lg",
                  animating && "animate-bounce"
                )}
              >
                {lastDrawn}
              </div>
            </div>
          )}

          {/* Draw button */}
          <button
            onClick={handleDraw}
            disabled={drawing || isCompleted}
            className={clsx(
              "px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-md",
              isCompleted
                ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 active:scale-95 text-white hover:shadow-lg"
            )}
          >
            {drawing
              ? "Drawing..."
              : isCompleted
                ? "Game Completed"
                : "DRAW NEXT NUMBER"}
          </button>

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            <Hash size={13} className="inline -mt-0.5" />{" "}
            {game.drawnNumbers.length} of 90 numbers drawn
          </p>

          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* ── Number Board ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Number Board
          </h2>
          <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
            {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
              const isDrawn = drawnSet.has(num);
              const isLast = num === lastDrawn;
              return (
                <div
                  key={num}
                  className={clsx(
                    "aspect-square flex items-center justify-center rounded-md text-xs sm:text-sm font-semibold transition-all",
                    isLast && animating
                      ? "bg-purple-600 text-white ring-2 ring-purple-400 ring-offset-1 dark:ring-offset-gray-800 animate-pulse scale-110"
                      : isLast
                        ? "bg-purple-600 text-white ring-2 ring-purple-400 ring-offset-1 dark:ring-offset-gray-800"
                        : isDrawn
                          ? "bg-blue-600 dark:bg-blue-500 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                  )}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Prize Tracker ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
            Prize Tracker
          </h2>
          <div className="space-y-2">
            {PRIZE_ORDER.map((type) => {
              const claimed = claimedPrizes.get(type);
              return (
                <div
                  key={type}
                  className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-lg border",
                    claimed
                      ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                      : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700"
                  )}
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {PRIZE_LABELS[type]}
                  </span>
                  {claimed ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Check
                        size={16}
                        className="text-green-600 dark:text-green-400"
                      />
                      <span className="font-medium text-green-700 dark:text-green-300">
                        {claimed.playerName}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">
                        {new Date(claimed.claimedAt).toLocaleTimeString(
                          "en-IN",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
                      <Clock size={14} />
                      <span>&mdash;</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Drawn Numbers History (scrollable) ────────────────────── */}
        {game.drawnNumbers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Draw Order
            </h2>
            <div className="flex flex-wrap gap-2">
              {[...game.drawnNumbers].reverse().map((num, idx) => (
                <span
                  key={num}
                  className={clsx(
                    "inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold",
                    idx === 0
                      ? "bg-purple-600 text-white"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  )}
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── End Game ──────────────────────────────────────────────── */}
        {!isCompleted && (
          <div className="text-center mt-8 mb-4">
            <button
              onClick={handleEnd}
              disabled={ending}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              {ending ? "Ending..." : "End Game"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
