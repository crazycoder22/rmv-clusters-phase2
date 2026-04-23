import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Layers, Trophy } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import WordleLeaderboard from "../components/WordleLeaderboard";

type LetterResult = "correct" | "present" | "absent";
type GuessResult = { word: string; feedback: LetterResult[] };
type Tab = "game" | "leaderboard";

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

const KEYBOARD_ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["Enter", "z", "x", "c", "v", "b", "n", "m", "⌫"],
];

export default function Wordle() {
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [tab, setTab] = useState<Tab>("game");
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [won, setWon] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch existing game state on mount.
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/wordle/game?playerId=${playerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setGuesses(data.guesses ?? []);
        setWon(!!data.won);
        setCompleted(!!data.completed);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1500);
  }, []);

  const submitGuess = useCallback(async () => {
    if (!playerId || submitting || completed) return;
    if (currentGuess.length !== WORD_LENGTH) {
      showToast("5 letters, please");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/wordle/guess", {
        method: "POST",
        body: JSON.stringify({ playerId, guess: currentGuess }),
      });
      const data = (await res.json()) as {
        error?: string;
        guesses?: GuessResult[];
        won?: boolean;
        completed?: boolean;
        answer?: string;
      };
      if (!res.ok) {
        showToast(data.error ?? "Error");
        return;
      }
      setGuesses(data.guesses ?? []);
      setWon(!!data.won);
      setCompleted(!!data.completed);
      if (data.answer) setAnswer(data.answer);
      setCurrentGuess("");
    } catch {
      showToast("Network error");
    } finally {
      setSubmitting(false);
    }
  }, [currentGuess, playerId, submitting, completed, showToast]);

  const handleKey = useCallback(
    (key: string) => {
      if (completed || submitting) return;
      if (key === "Enter") {
        void submitGuess();
      } else if (key === "⌫" || key === "Backspace") {
        setCurrentGuess((g) => g.slice(0, -1));
      } else if (/^[a-z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((g) => g + key);
      }
    },
    [completed, submitting, submitGuess, currentGuess.length]
  );

  // Also support hardware keyboard (for browser dev).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (tab !== "game") return;
      const k = e.key;
      if (k === "Enter") handleKey("Enter");
      else if (k === "Backspace") handleKey("⌫");
      else if (/^[a-zA-Z]$/.test(k)) handleKey(k.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey, tab]);

  // Build letterStates for keyboard coloring.
  const letterStates = new Map<string, LetterResult>();
  for (const g of guesses) {
    g.word.split("").forEach((letter, i) => {
      const cur = letterStates.get(letter);
      const next = g.feedback[i];
      // Priority: correct > present > absent
      if (cur === "correct") return;
      if (cur === "present" && next === "absent") return;
      letterStates.set(letter, next);
    });
  }

  return (
    <div className="flex flex-1 flex-col px-3 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Wordle</h1>
        <div className="h-9 w-9" />
      </header>

      <div className="mb-3 flex justify-center">
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <TabButton active={tab === "game"} onClick={() => setTab("game")}>
            <Layers size={14} /> Game
          </TabButton>
          <TabButton
            active={tab === "leaderboard"}
            onClick={() => setTab("leaderboard")}
          >
            <Trophy size={14} /> Leaderboard
          </TabButton>
        </div>
      </div>

      {tab === "leaderboard" ? (
        <WordleLeaderboard currentPlayerId={playerId} />
      ) : loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading today's game…
        </div>
      ) : (
        <>
          <Board
            guesses={guesses}
            currentGuess={currentGuess}
            submitting={submitting}
          />

          {completed && (
            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/80 p-5 text-center">
              <div className="text-3xl">{won ? "🎉" : "💔"}</div>
              <h2 className="mt-2 text-lg font-bold text-white">
                {won
                  ? `Solved in ${guesses.length}/${MAX_ATTEMPTS}!`
                  : "Better luck tomorrow"}
              </h2>
              {!won && answer && (
                <p className="mt-1 text-sm text-slate-400">
                  The word was{" "}
                  <span className="font-mono font-bold uppercase text-white">
                    {answer}
                  </span>
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">New word at midnight IST</p>
            </div>
          )}

          <div className="mt-auto">
            {toast && (
              <div className="mb-2 text-center">
                <span className="inline-block rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900">
                  {toast}
                </span>
              </div>
            )}
            <Keyboard letterStates={letterStates} onKey={handleKey} />
          </div>
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
        "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-slate-700 text-white shadow-sm" : "text-slate-400"
      )}
    >
      {children}
    </button>
  );
}

function Board({
  guesses,
  currentGuess,
  submitting,
}: {
  guesses: GuessResult[];
  currentGuess: string;
  submitting: boolean;
}) {
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (i < guesses.length) {
      rows.push(
        <div key={i} className="flex justify-center gap-1.5">
          {guesses[i].word.split("").map((letter, j) => (
            <Cell
              key={j}
              letter={letter}
              state={guesses[i].feedback[j]}
            />
          ))}
        </div>
      );
    } else if (i === guesses.length) {
      rows.push(
        <div key={i} className="flex justify-center gap-1.5">
          {Array.from({ length: WORD_LENGTH }).map((_, j) => (
            <Cell
              key={j}
              letter={currentGuess[j] ?? ""}
              active={j < currentGuess.length}
              submitting={submitting}
            />
          ))}
        </div>
      );
    } else {
      rows.push(
        <div key={i} className="flex justify-center gap-1.5">
          {Array.from({ length: WORD_LENGTH }).map((_, j) => (
            <Cell key={j} />
          ))}
        </div>
      );
    }
  }
  return <div className="flex flex-col gap-1.5 px-4 py-4">{rows}</div>;
}

function Cell({
  letter,
  state,
  active,
  submitting,
}: {
  letter?: string;
  state?: LetterResult;
  active?: boolean;
  submitting?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex h-14 w-14 items-center justify-center rounded-lg border-2 text-2xl font-bold uppercase transition-all",
        state === "correct" && "border-green-500 bg-green-500 text-white",
        state === "present" && "border-yellow-500 bg-yellow-500 text-white",
        state === "absent" && "border-slate-600 bg-slate-600 text-white",
        !state &&
          (active
            ? "border-slate-400 text-white"
            : submitting
              ? "animate-pulse border-slate-500"
              : "border-slate-700")
      )}
    >
      {letter ?? ""}
    </div>
  );
}

function Keyboard({
  letterStates,
  onKey,
}: {
  letterStates: Map<string, LetterResult>;
  onKey: (key: string) => void;
}) {
  const classFor = (key: string) => {
    const state = letterStates.get(key.toLowerCase());
    if (state === "correct") return "bg-green-500 text-white";
    if (state === "present") return "bg-yellow-500 text-white";
    if (state === "absent") return "bg-slate-700 text-slate-400";
    return "bg-slate-600 text-white active:bg-slate-500";
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={i} className="flex w-full justify-center gap-[5px] px-1">
          {row.map((key) => {
            const isWide = key === "Enter" || key === "⌫";
            return (
              <button
                key={key}
                onClick={() => onKey(key)}
                className={clsx(
                  "h-12 rounded-md text-sm font-semibold uppercase select-none transition-transform active:scale-95",
                  classFor(key),
                  isWide ? "min-w-[48px] flex-[1.5] text-xs" : "flex-1"
                )}
              >
                {key === "⌫" ? "⌫" : key.toUpperCase()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
