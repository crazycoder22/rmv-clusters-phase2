import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
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

// Wordle state palette — saturated tones that read in both themes.
const CORRECT = "#15803d";
const PRESENT = "#b08d18";

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
        if (data.answer) setAnswer(data.answer);
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
      showToast("Not enough letters");
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
    <div
      className="one-surface flex flex-1 flex-col px-[16px] pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center justify-between py-4">
        <Link
          to="/games"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: "var(--text-2)" }}
        >
          <Icon name="arrow_back" size={22} />
        </Link>
        <h1 className="text-[18px] font-bold" style={{ color: "var(--text)" }}>Wordle</h1>
        <div className="h-9 w-9" />
      </header>

      {/* Game / Leaderboard segmented */}
      <div className="mb-3 flex justify-center">
        <div
          className="flex w-full rounded-[14px] p-1"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <TabButton active={tab === "game"} onClick={() => setTab("game")} icon="style">
            Game
          </TabButton>
          <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} icon="emoji_events">
            Leaderboard
          </TabButton>
        </div>
      </div>

      {tab === "leaderboard" ? (
        <WordleLeaderboard currentPlayerId={playerId} />
      ) : loading ? (
        <div className="py-16 text-center text-[14px]" style={{ color: "var(--text-3)" }}>
          Loading today's game…
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center">
          {/* toast */}
          <div className="flex h-6 items-center justify-center">
            {toast && (
              <span className="text-[13.5px] font-bold" style={{ color: "#f87171" }}>{toast}</span>
            )}
          </div>

          <Board
            guesses={guesses}
            currentGuess={currentGuess}
            submitting={submitting}
          />

          {completed && (
            <div
              className="mt-4 flex w-full items-center gap-3 rounded-[16px] p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-extrabold" style={{ color: "var(--text)" }}>
                  {won ? `Solved in ${guesses.length}/${MAX_ATTEMPTS}! 🎉` : "Out of guesses"}
                </div>
                <div className="mt-0.5 text-[13px]" style={{ color: "var(--text-2)" }}>
                  {won ? (
                    "Nicely done — new word at midnight IST."
                  ) : answer ? (
                    <>The word was <span className="one-mono font-bold uppercase" style={{ color: "var(--text)" }}>{answer}</span>.</>
                  ) : (
                    "New word at midnight IST."
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-auto w-full pt-4">
            <Keyboard letterStates={letterStates} onKey={handleKey} />
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[14px] font-bold transition-colors"
      style={active ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" } : { background: "transparent", color: "var(--text-3)" }}
    >
      <Icon name={icon} size={18} />
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
        <div key={i} className="grid grid-cols-5 gap-1.5">
          {guesses[i].word.split("").map((letter, j) => (
            <Cell key={j} letter={letter} state={guesses[i].feedback[j]} />
          ))}
        </div>
      );
    } else if (i === guesses.length) {
      rows.push(
        <div key={i} className="grid grid-cols-5 gap-1.5">
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
        <div key={i} className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: WORD_LENGTH }).map((_, j) => (
            <Cell key={j} />
          ))}
        </div>
      );
    }
  }
  return <div className="flex w-full max-w-[280px] flex-col gap-1.5">{rows}</div>;
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
  let style: React.CSSProperties;
  if (state === "correct") {
    style = { background: CORRECT, color: "#fff", border: `2px solid ${CORRECT}` };
  } else if (state === "present") {
    style = { background: PRESENT, color: "#fff", border: `2px solid ${PRESENT}` };
  } else if (state === "absent") {
    style = { background: "var(--surface-3)", color: "var(--text-3)", border: "2px solid var(--surface-3)" };
  } else {
    style = {
      background: "transparent",
      color: "var(--text)",
      border: `2px solid ${active ? "var(--strong)" : "var(--line)"}`,
    };
  }
  return (
    <div
      className={`flex aspect-square items-center justify-center rounded-[10px] text-[24px] font-extrabold uppercase ${!state && submitting ? "animate-pulse" : ""}`}
      style={style}
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
  const styleFor = (key: string): React.CSSProperties => {
    const state = letterStates.get(key.toLowerCase());
    if (state === "correct") return { background: CORRECT, color: "#fff" };
    if (state === "present") return { background: PRESENT, color: "#fff" };
    if (state === "absent") return { background: "var(--surface-3)", color: "var(--text-3)" };
    return { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-strong)" };
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={i} className="flex w-full justify-center gap-[5px]">
          {row.map((key) => {
            const isWide = key === "Enter" || key === "⌫";
            return (
              <button
                key={key}
                onClick={() => onKey(key)}
                className="flex h-12 items-center justify-center rounded-[8px] text-[14px] font-bold uppercase select-none transition-transform active:scale-95"
                style={{ ...styleFor(key), flex: isWide ? 1.6 : 1 }}
              >
                {key === "⌫" ? <Icon name="backspace" size={20} /> : key === "Enter" ? "Enter" : key.toUpperCase()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
