"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Users, Check, Loader2, Trophy, PartyPopper } from "lucide-react";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Prize {
  type: string;
  label: string;
  winner?: string | null;
  winnerName?: string | null;
}

interface SessionData {
  id: string;
  code: string;
  title: string;
  status: "WAITING" | "ACTIVE" | "COMPLETED";
  drawnNumbers: number[];
  prizes: Prize[];
  playerCount: number;
  ticket: number[][] | null;
  markedNumbers: number[];
}

// ── Prize config ──────────────────────────────────────────────────────────────

const PRIZE_CONFIG = [
  { type: "EARLY_FIVE", label: "Early Five", emoji: "\u2B50", color: "text-yellow-500" },
  { type: "TOP_LINE", label: "Top Line", emoji: "\uD83D\uDD34", color: "text-red-500" },
  { type: "MIDDLE_LINE", label: "Middle Line", emoji: "\uD83D\uDFE1", color: "text-yellow-500" },
  { type: "BOTTOM_LINE", label: "Bottom Line", emoji: "\uD83D\uDD35", color: "text-blue-500" },
  { type: "FULL_HOUSE", label: "Full House", emoji: "\uD83C\uDFC6", color: "text-amber-500" },
];

// ── Input class (shared) ──────────────────────────────────────────────────────

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none";

// ── Registration form ─────────────────────────────────────────────────────────

function RegistrationForm({
  onRegister,
}: {
  onRegister: (playerId: string, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/wordle/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          block: Number(block),
          flatNumber,
          email,
          phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }
      localStorage.setItem("tambola_player_id", data.playerId);
      localStorage.setItem("tambola_player_name", data.name);
      onRegister(data.playerId, data.name);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">
          Welcome to Tambola!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Enter your details to join the game
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name"
            required
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              placeholder="Block Number"
              required
              min={1}
              className={inputClass}
            />
            <input
              type="text"
              value={flatNumber}
              onChange={(e) => setFlatNumber(e.target.value)}
              placeholder="Flat Number"
              required
              className={inputClass}
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className={inputClass}
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone Number"
            required
            className={inputClass}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? "Registering..." : "Join Game"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Prize Status Bar ──────────────────────────────────────────────────────────

function PrizeStatusBar({ prizes }: { prizes: Prize[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2">
      <div className="grid grid-cols-5 gap-1">
        {PRIZE_CONFIG.map((pc) => {
          const prize = prizes.find((p) => p.type === pc.type);
          const won = prize?.winnerName;
          return (
            <div
              key={pc.type}
              className={clsx(
                "flex flex-col items-center text-center py-1.5 px-0.5 rounded-lg transition-colors",
                won
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-gray-50 dark:bg-gray-700/50"
              )}
            >
              <span className="text-base leading-none">{pc.emoji}</span>
              <span
                className={clsx(
                  "text-[9px] font-semibold mt-0.5 leading-tight",
                  won
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {pc.label.replace(" ", "\n").split("\n").map((part, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {part}
                  </span>
                ))}
              </span>
              {won && (
                <span className="text-[8px] text-green-600 dark:text-green-400 font-medium mt-0.5 truncate max-w-full px-0.5">
                  {won}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Ticket Grid (3 rows x 9 cols) ────────────────────────────────────────────

function TicketGrid({
  ticket,
  drawnNumbers,
  markedNumbers,
  onMark,
  disabled,
}: {
  ticket: number[][];
  drawnNumbers: number[];
  markedNumbers: number[];
  onMark: (num: number) => void;
  disabled: boolean;
}) {
  const drawnSet = new Set(drawnNumbers);
  const markedSet = new Set(markedNumbers);
  const lastDrawn = drawnNumbers.length > 0 ? drawnNumbers[drawnNumbers.length - 1] : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-400 dark:border-primary-600 overflow-hidden">
      <div className="px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800">
        <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 text-center uppercase tracking-wider">
          Your Ticket
        </p>
      </div>
      <div className="p-1.5">
        {ticket.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-9 gap-0.5 mb-0.5 last:mb-0">
            {row.map((num, colIdx) => {
              const isBlank = num === 0;
              const isDrawn = !isBlank && drawnSet.has(num);
              const isMarked = !isBlank && markedSet.has(num);
              const isLastDrawn = num === lastDrawn;
              const canTap = isDrawn && !isMarked && !disabled;

              return (
                <button
                  key={colIdx}
                  disabled={!canTap}
                  onClick={() => canTap && onMark(num)}
                  className={clsx(
                    "aspect-[4/3] flex items-center justify-center rounded text-xs sm:text-sm font-bold transition-all relative",
                    isBlank &&
                      "bg-gray-100 dark:bg-gray-700/40 cursor-default",
                    !isBlank &&
                      isMarked &&
                      "bg-green-500 dark:bg-green-600 text-white shadow-sm",
                    !isBlank &&
                      !isMarked &&
                      isDrawn &&
                      "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-2 border-primary-400 dark:border-primary-500 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 active:scale-95",
                    !isBlank &&
                      !isMarked &&
                      !isDrawn &&
                      "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-default",
                    isLastDrawn &&
                      !isMarked &&
                      isDrawn &&
                      "animate-pulse ring-2 ring-primary-400 dark:ring-primary-500"
                  )}
                >
                  {!isBlank && (
                    <>
                      {isMarked ? (
                        <span className="flex items-center gap-0.5">
                          {num}
                          <Check size={10} className="shrink-0" />
                        </span>
                      ) : (
                        num
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Claim Button ──────────────────────────────────────────────────────────────

function ClaimButton({
  prizeType,
  label,
  emoji,
  onClaim,
  claiming,
}: {
  prizeType: string;
  label: string;
  emoji: string;
  onClaim: (type: string) => void;
  claiming: boolean;
}) {
  return (
    <button
      onClick={() => onClaim(prizeType)}
      disabled={claiming}
      className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm shadow-lg hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {claiming ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <>
          <span>{emoji}</span>
          Claim {label}!
        </>
      )}
    </button>
  );
}

// ── Number Board (1-90) ───────────────────────────────────────────────────────

function NumberBoard({
  drawnNumbers,
}: {
  drawnNumbers: number[];
}) {
  const drawnSet = new Set(drawnNumbers);
  const lastDrawn = drawnNumbers.length > 0 ? drawnNumbers[drawnNumbers.length - 1] : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center mb-1.5">
        Numbers Drawn ({drawnNumbers.length}/90)
      </p>
      <div className="grid grid-cols-10 gap-0.5">
        {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
          const isDrawn = drawnSet.has(num);
          const isLast = num === lastDrawn;
          return (
            <div
              key={num}
              className={clsx(
                "aspect-square flex items-center justify-center rounded text-[10px] sm:text-xs font-semibold transition-all",
                isLast &&
                  "bg-primary-500 text-white ring-2 ring-primary-300 dark:ring-primary-400 animate-pulse shadow-md",
                isDrawn &&
                  !isLast &&
                  "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300",
                !isDrawn &&
                  "bg-gray-50 dark:bg-gray-700/40 text-gray-300 dark:text-gray-600"
              )}
            >
              {num}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Completed Results ─────────────────────────────────────────────────────────

function CompletedResults({ prizes }: { prizes: Prize[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-center">
        <div className="flex items-center justify-center gap-2">
          <Trophy size={18} className="text-amber-500" />
          <span className="font-bold text-amber-700 dark:text-amber-300 text-sm">
            Game Results
          </span>
          <Trophy size={18} className="text-amber-500" />
        </div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {PRIZE_CONFIG.map((pc) => {
          const prize = prizes.find((p) => p.type === pc.type);
          const winnerName = prize?.winnerName;
          return (
            <div
              key={pc.type}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{pc.emoji}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {pc.label}
                </span>
              </div>
              {winnerName ? (
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {winnerName}
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Unclaimed
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div
        className={clsx(
          "px-4 py-2 rounded-lg shadow-lg text-sm font-medium",
          type === "success" && "bg-green-600 text-white",
          type === "error" && "bg-red-600 text-white"
        )}
      >
        {message}
      </div>
    </div>
  );
}

// ── Client-side prize eligibility check ───────────────────────────────────────

function getClaimablePrizes(
  ticket: number[][],
  markedNumbers: number[],
  prizes: Prize[]
): string[] {
  const markedSet = new Set(markedNumbers);
  const claimable: string[] = [];

  // Get all non-zero numbers in each row
  const rowNumbers = ticket.map((row) => row.filter((n) => n !== 0));

  // Early Five: at least 5 numbers marked
  if (markedNumbers.length >= 5) {
    const prize = prizes.find((p) => p.type === "EARLY_FIVE");
    if (prize && !prize.winnerName) claimable.push("EARLY_FIVE");
  }

  // Top Line: all numbers in row 0 marked
  if (rowNumbers[0].every((n) => markedSet.has(n))) {
    const prize = prizes.find((p) => p.type === "TOP_LINE");
    if (prize && !prize.winnerName) claimable.push("TOP_LINE");
  }

  // Middle Line: all numbers in row 1 marked
  if (rowNumbers[1].every((n) => markedSet.has(n))) {
    const prize = prizes.find((p) => p.type === "MIDDLE_LINE");
    if (prize && !prize.winnerName) claimable.push("MIDDLE_LINE");
  }

  // Bottom Line: all numbers in row 2 marked
  if (rowNumbers[2].every((n) => markedSet.has(n))) {
    const prize = prizes.find((p) => p.type === "BOTTOM_LINE");
    if (prize && !prize.winnerName) claimable.push("BOTTOM_LINE");
  }

  // Full House: all numbers on ticket marked
  const allNumbers = rowNumbers.flat();
  if (allNumbers.every((n) => markedSet.has(n))) {
    const prize = prizes.find((p) => p.type === "FULL_HOUSE");
    if (prize && !prize.winnerName) claimable.push("FULL_HOUSE");
  }

  return claimable;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TambolaGamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { data: session, status: sessionStatus } = useSession();

  // Player state
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(true);

  // Join state
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Game state
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([]);

  // UI state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [claiming, setClaiming] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Resolve player ID ───────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus === "loading") return;

    // Auto-register for logged-in users
    if (session?.user?.email) {
      fetch("/api/wordle/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromSession: true }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            localStorage.setItem("tambola_player_id", data.playerId);
            localStorage.setItem("tambola_player_name", data.name);
            setPlayerId(data.playerId);
            setPlayerName(data.name);
          } else {
            restoreFromStorage();
          }
        })
        .catch(() => restoreFromStorage())
        .finally(() => setLoading(false));
      return;
    }

    restoreFromStorage();
    setLoading(false);
  }, [session, sessionStatus]);

  const restoreFromStorage = () => {
    // Check tambola, then wordle, then sudoku keys
    const keys = ["tambola", "wordle", "sudoku"];
    for (const prefix of keys) {
      const id = localStorage.getItem(`${prefix}_player_id`);
      const name = localStorage.getItem(`${prefix}_player_name`);
      if (id) {
        // Ensure tambola keys are set
        localStorage.setItem("tambola_player_id", id);
        if (name) localStorage.setItem("tambola_player_name", name);
        setPlayerId(id);
        setPlayerName(name || "");
        return;
      }
    }
  };

  // ── Auto-join game ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!playerId || joined || joining) return;
    setJoining(true);
    setJoinError("");

    fetch(`/api/tambola/sessions/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setJoinError(data.error || "Failed to join game");
          return;
        }
        setJoined(true);
        if (data.markedNumbers) setMarkedNumbers(data.markedNumbers);
      })
      .catch(() => setJoinError("Network error. Please try again."))
      .finally(() => setJoining(false));
  }, [playerId, joined, joining, code]);

  // ── Polling ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!playerId || !joined) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/tambola/sessions/${code}?playerId=${playerId}`
        );
        if (!res.ok) return;
        const data: SessionData = await res.json();
        setSessionData(data);
        if (data.markedNumbers) setMarkedNumbers(data.markedNumbers);
      } catch {
        // silent
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [code, playerId, joined]);

  // ── Mark number ─────────────────────────────────────────────────────────────

  const handleMark = useCallback(
    async (num: number) => {
      if (!playerId || !sessionData) return;
      // Optimistic update
      setMarkedNumbers((prev) => {
        if (prev.includes(num)) return prev;
        return [...prev, num];
      });

      try {
        const res = await fetch(`/api/tambola/sessions/${code}/mark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, number: num }),
        });
        if (res.ok) {
          const data = await res.json();
          setMarkedNumbers(data.markedNumbers);
        }
      } catch {
        // Revert on error
        setMarkedNumbers((prev) => prev.filter((n) => n !== num));
      }
    },
    [playerId, code, sessionData]
  );

  // ── Claim prize ─────────────────────────────────────────────────────────────

  const handleClaim = useCallback(
    async (prizeType: string) => {
      if (!playerId || claiming) return;
      setClaiming(true);

      try {
        const res = await fetch(`/api/tambola/sessions/${code}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, prizeType }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          const label =
            PRIZE_CONFIG.find((p) => p.type === prizeType)?.label || prizeType;
          showToast(`You claimed ${label}!`, "success");
        } else {
          showToast(data.error || "Claim failed", "error");
        }
      } catch {
        showToast("Network error", "error");
      } finally {
        setClaiming(false);
      }
    },
    [playerId, code, claiming]
  );

  // ── Derived state ───────────────────────────────────────────────────────────

  const status = sessionData?.status ?? "WAITING";
  const drawnNumbers = sessionData?.drawnNumbers ?? [];
  const prizes = sessionData?.prizes ?? [];
  const ticket = sessionData?.ticket ?? null;
  const playerCount = sessionData?.playerCount ?? 0;

  const claimablePrizes =
    ticket && status === "ACTIVE"
      ? getClaimablePrizes(ticket, markedNumbers, prizes)
      : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Not registered
  if (!playerId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/tambola"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Tambola
          </h1>
          <div className="w-5" />
        </div>
        <RegistrationForm
          onRegister={(id, name) => {
            setPlayerId(id);
            setPlayerName(name);
          }}
        />
      </div>
    );
  }

  // Joining
  if (!joined) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/tambola"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Tambola
          </h1>
          <div className="w-5" />
        </div>
        <div className="text-center py-16">
          {joining ? (
            <div className="space-y-3">
              <Loader2
                size={32}
                className="animate-spin text-primary-500 mx-auto"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Joining game...
              </p>
            </div>
          ) : joinError ? (
            <div className="space-y-3">
              <p className="text-sm text-red-500">{joinError}</p>
              <button
                onClick={() => {
                  setJoining(false);
                  setJoinError("");
                  // Trigger re-join
                  setJoined(false);
                }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Game view ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-8">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/tambola"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Tambola
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            {code}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Users size={12} />
            {playerCount}
          </span>
        </div>
      </div>

      {/* Status banner */}
      {status === "WAITING" && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 mb-3 text-center">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            Waiting for host to start drawing...
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
            Your ticket is ready below
          </p>
        </div>
      )}

      {status === "COMPLETED" && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <PartyPopper size={18} className="text-amber-500" />
            <span className="font-bold text-amber-700 dark:text-amber-300">
              Game Over
            </span>
            <PartyPopper size={18} className="text-amber-500" />
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Thanks for playing!
          </p>
        </div>
      )}

      <div className="space-y-3">
        {/* Prize Status Bar */}
        <PrizeStatusBar prizes={prizes} />

        {/* Ticket */}
        {ticket && (
          <TicketGrid
            ticket={ticket}
            drawnNumbers={drawnNumbers}
            markedNumbers={markedNumbers}
            onMark={handleMark}
            disabled={status !== "ACTIVE"}
          />
        )}

        {/* Claim buttons */}
        {claimablePrizes.length > 0 && (
          <div className="space-y-2">
            {claimablePrizes.map((type) => {
              const pc = PRIZE_CONFIG.find((p) => p.type === type)!;
              return (
                <ClaimButton
                  key={type}
                  prizeType={type}
                  label={pc.label}
                  emoji={pc.emoji}
                  onClaim={handleClaim}
                  claiming={claiming}
                />
              );
            })}
          </div>
        )}

        {/* Number Board */}
        {drawnNumbers.length > 0 && (
          <NumberBoard drawnNumbers={drawnNumbers} />
        )}

        {/* Completed Results */}
        {status === "COMPLETED" && <CompletedResults prizes={prizes} />}

        {/* Completed ticket display */}
        {status === "COMPLETED" && ticket && (
          <div className="opacity-75">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mb-1 uppercase tracking-wider font-semibold">
              Your Final Ticket
            </p>
          </div>
        )}
      </div>

      {/* Player info footer */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Playing as{" "}
          <span className="font-medium text-gray-500 dark:text-gray-400">
            {playerName}
          </span>
        </p>
        <button
          onClick={() => {
            localStorage.removeItem("tambola_player_id");
            localStorage.removeItem("tambola_player_name");
            setPlayerId(null);
            setPlayerName("");
            setJoined(false);
            setSessionData(null);
          }}
          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Switch player
        </button>
      </div>
    </div>
  );
}
