"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { Trophy, ArrowLeft, Share2 } from "lucide-react";
import AdBanner from "@/components/ads/AdBanner";

type LetterResult = "correct" | "present" | "absent";

interface GuessResult {
  word: string;
  feedback: LetterResult[];
}

const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["Enter", "z", "x", "c", "v", "b", "n", "m", "⌫"],
];

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

function GameBoard({
  guesses,
  currentGuess,
  shakeRow,
  submitting,
}: {
  guesses: GuessResult[];
  currentGuess: string;
  shakeRow: number | null;
  submitting: boolean;
}) {
  const rows = [];

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const isShaking = shakeRow === i;

    if (i < guesses.length) {
      // Completed guess row
      rows.push(
        <div key={i} className={`flex gap-1.5 justify-center ${isShaking ? "animate-shake" : ""}`}>
          {guesses[i].word.split("").map((letter, j) => (
            <div
              key={j}
              className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-xl sm:text-2xl font-bold rounded-lg border-2 text-white uppercase transition-all ${
                guesses[i].feedback[j] === "correct"
                  ? "bg-green-500 border-green-500"
                  : guesses[i].feedback[j] === "present"
                  ? "bg-yellow-500 border-yellow-500"
                  : "bg-gray-500 border-gray-500 dark:bg-gray-600 dark:border-gray-600"
              }`}
              style={{ animationDelay: `${j * 100}ms` }}
            >
              {letter}
            </div>
          ))}
        </div>
      );
    } else if (i === guesses.length) {
      // Current guess row
      rows.push(
        <div key={i} className={`flex gap-1.5 justify-center ${isShaking ? "animate-shake" : ""}`}>
          {Array.from({ length: WORD_LENGTH }).map((_, j) => (
            <div
              key={j}
              className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-xl sm:text-2xl font-bold rounded-lg border-2 uppercase transition-all ${
                submitting
                  ? "border-gray-400 dark:border-gray-500 animate-pulse"
                  : j < currentGuess.length
                  ? "border-gray-500 dark:border-gray-400 text-gray-800 dark:text-gray-100"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {currentGuess[j] || ""}
            </div>
          ))}
        </div>
      );
    } else {
      // Empty row
      rows.push(
        <div key={i} className="flex gap-1.5 justify-center">
          {Array.from({ length: WORD_LENGTH }).map((_, j) => (
            <div
              key={j}
              className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-xl sm:text-2xl font-bold rounded-lg border-2 border-gray-200 dark:border-gray-700"
            />
          ))}
        </div>
      );
    }
  }

  return <div className="flex flex-col gap-1.5">{rows}</div>;
}

function Keyboard({
  letterStates,
  onKey,
}: {
  letterStates: Map<string, LetterResult>;
  onKey: (key: string) => void;
}) {
  const getKeyClass = (key: string) => {
    const state = letterStates.get(key.toLowerCase());
    if (state === "correct") return "bg-green-500 text-white border-green-500 hover:bg-green-600";
    if (state === "present") return "bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600";
    if (state === "absent") return "bg-gray-400 text-white border-gray-400 dark:bg-gray-600 dark:border-gray-600";
    return "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600";
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={i} className="flex gap-1 sm:gap-1.5">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => onKey(key)}
              className={`${
                key.length > 1 ? "px-2 sm:px-3 text-xs" : "w-8 sm:w-10"
              } h-12 sm:h-14 rounded-md font-semibold border transition-colors uppercase text-sm sm:text-base ${getKeyClass(key)}`}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function WordlePage() {
  const { data: session, status: sessionStatus } = useSession();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [won, setWon] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Redirect unauthenticated users to sign-in
  useEffect(() => {
    if (sessionStatus !== "loading" && !session) {
      signIn("google", { callbackUrl: "/wordle" });
    }
  }, [session, sessionStatus]);

  // Auto-register signed-in users
  useEffect(() => {
    if (sessionStatus === "loading" || !session?.user?.email) return;

    const storedId = localStorage.getItem("wordle_player_id");
    const storedName = localStorage.getItem("wordle_player_name");

    fetch("/api/wordle/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSession: true }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          localStorage.setItem("wordle_player_id", data.playerId);
          localStorage.setItem("wordle_player_name", data.name);
          setPlayerId(data.playerId);
          setPlayerName(data.name);
        } else if (storedId) {
          // Fallback to stored ID if auto-register fails
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

  // Fetch today's game state
  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/wordle/game?playerId=${playerId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setGuesses(data.guesses || []);
          setWon(data.won);
          setCompleted(data.completed);
        }
      })
      .catch(() => {});
  }, [playerId]);

  // Build letter states from all guesses
  const letterStates = new Map<string, LetterResult>();
  for (const g of guesses) {
    for (let i = 0; i < g.word.length; i++) {
      const letter = g.word[i].toLowerCase();
      const current = letterStates.get(letter);
      const feedback = g.feedback[i];
      // Priority: correct > present > absent
      if (feedback === "correct" || !current) {
        letterStates.set(letter, feedback);
      } else if (feedback === "present" && current !== "correct") {
        letterStates.set(letter, feedback);
      }
    }
  }

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2000);
  };

  const shake = () => {
    setShakeRow(guesses.length);
    setTimeout(() => setShakeRow(null), 600);
  };

  const submitGuess = useCallback(async () => {
    if (completed || submitting) return;
    if (currentGuess.length !== WORD_LENGTH) {
      showMessage("Not enough letters");
      shake();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wordle/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, guess: currentGuess }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Stale player ID — clear and force re-registration
        if (res.status === 404) {
          localStorage.removeItem("wordle_player_id");
          localStorage.removeItem("wordle_player_name");
          setPlayerId(null);
          setPlayerName("");
          setGuesses([]);
          setCurrentGuess("");
          showMessage("Session expired. Please register again.");
          return;
        }
        showMessage(data.error || "Invalid guess");
        shake();
        return;
      }

      setGuesses(data.guesses);
      setCurrentGuess("");
      setWon(data.won);
      setCompleted(data.completed);
      if (data.answer) setAnswer(data.answer);

      if (data.won) {
        const attemptMessages = ["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"];
        showMessage(attemptMessages[data.guesses.length - 1] || "You won!");
      } else if (data.completed) {
        showMessage(`The word was ${data.answer?.toUpperCase()}`);
      }
    } catch {
      showMessage("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [currentGuess, playerId, completed, submitting]);

  const handleKey = useCallback(
    (key: string) => {
      if (completed || submitting) return;

      if (key === "Enter") {
        submitGuess();
        return;
      }

      if (key === "⌫" || key === "Backspace") {
        setCurrentGuess((prev) => prev.slice(0, -1));
        return;
      }

      if (/^[a-zA-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((prev) => prev + key.toLowerCase());
      }
    },
    [currentGuess, completed, submitting, submitGuess]
  );

  // Physical keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      handleKey(e.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  const handleShare = () => {
    const emojiGrid = guesses
      .map((g) =>
        g.feedback
          .map((f) => (f === "correct" ? "🟩" : f === "present" ? "🟨" : "⬛"))
          .join("")
      )
      .join("\n");

    const text = `RMV Wordle ${guesses.length}/${MAX_ATTEMPTS}\n\n${emojiGrid}`;

    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => showMessage("Copied to clipboard!"));
    }
  };

  if (sessionStatus === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Wordle</h1>
        <Link
          href="/wordle/leaderboard"
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          title="Leaderboard"
        >
          <Trophy size={20} />
        </Link>
      </div>

      <AdBanner page="wordle" placement="top" />

      {!playerId ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-gray-500">Setting up your game...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Player info */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Playing as <span className="font-medium text-gray-700 dark:text-gray-300">{playerName}</span>
            </p>
          </div>

          {/* Message toast */}
          {message && (
            <div className="text-center">
              <span className="inline-block bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 px-4 py-2 rounded-lg text-sm font-medium">
                {message}
              </span>
            </div>
          )}

          {/* Game board */}
          <GameBoard guesses={guesses} currentGuess={currentGuess} shakeRow={shakeRow} submitting={submitting} />

          {/* Game over message */}
          {completed && (
            <div className="text-center space-y-3">
              {won ? (
                <p className="text-green-600 dark:text-green-400 font-semibold text-lg">
                  You got it in {guesses.length} {guesses.length === 1 ? "guess" : "guesses"}!
                </p>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  The word was <span className="font-bold text-gray-800 dark:text-gray-200 uppercase">{answer}</span>
                </p>
              )}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  <Share2 size={16} />
                  Share Result
                </button>
                <Link
                  href="/wordle/leaderboard"
                  className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Trophy size={16} />
                  Leaderboard
                </Link>
              </div>
              <p className="text-xs text-gray-400">
                Next word at midnight IST
              </p>
            </div>
          )}

          {/* Keyboard */}
          {!completed && (
            <Keyboard letterStates={letterStates} onKey={handleKey} />
          )}
        </div>
      )}

      <AdBanner page="wordle" placement="bottom" />
    </div>
  );
}
