import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import AnagramLeaderboard from "../components/AnagramLeaderboard";

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

const REASON_TEXT: Record<string, string> = {
  TOO_SHORT: "At least 4 letters",
  MISSING_REQUIRED: "Must include centre letter",
  BAD_LETTER: "Letter not in puzzle",
  NOT_A_WORD: "Not in dictionary",
  ALREADY_FOUND: "Already found",
  BAD_REQUEST: "Try again",
};

export default function Anagram() {
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [tab, setTab] = useState<Tab>("game");
  const [game, setGame] = useState<GameState | null>(null);
  const [orderedOuter, setOrderedOuter] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) return;
    const res = await apiFetch(`/api/anagram/game?playerId=${playerId}`);
    if (!res.ok) return;
    const data = (await res.json()) as GameState;
    setGame(data);
    setOrderedOuter((prev) => {
      if (prev.length === 6) return prev;
      const outer = data.letters.filter((l) => l !== data.required);
      while (outer.length < 6) outer.push("");
      return outer.slice(0, 6);
    });
  }, [playerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Hardware keyboard (browser dev)
  useEffect(() => {
    if (tab !== "game") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submitWord();
      } else if (e.key === "Backspace") {
        setInput((s) => s.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const c = e.key.toLowerCase();
        if (game?.letters.includes(c)) setInput((s) => s + c);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, game]);

  const flashToast = (msg: string, error = false) => {
    setToast(msg);
    setToastError(error);
    window.setTimeout(() => setToast(null), 1500);
  };

  const submitWord = useCallback(async () => {
    if (!playerId || submitting) return;
    const word = input.trim();
    if (!word) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/anagram/guess", {
        method: "POST",
        body: JSON.stringify({ playerId, word }),
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
        flashToast(data.isPangram ? `🌟 Pangram +${data.score}` : `+${data.score}`);
        setInput("");
      } else {
        flashToast(REASON_TEXT[data.reason] ?? "Invalid", true);
      }
    } finally {
      setSubmitting(false);
    }
  }, [playerId, input, submitting]);

  const shuffle = () => {
    if (!game) return;
    const outer = game.letters.filter((l) => l !== game.required);
    setOrderedOuter(shuffleArray(outer).concat(["", "", "", "", "", ""]).slice(0, 6));
  };

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-2.5 py-3">
        <Link to="/games" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text)" }} />
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Anagram</h1>
      </header>

      {/* Game / Leaderboard segmented */}
      <div className="mb-2.5 flex rounded-[14px] p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {([["game", "style", "Game"], ["leaderboard", "emoji_events", "Leaderboard"]] as const).map(([key, ms, label]) => {
          const on = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[14px] font-bold transition-colors"
              style={on ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" } : { background: "transparent", color: "var(--text-3)" }}
            >
              <Icon name={ms} size={18} style={{ color: on ? "var(--text)" : "var(--text-3)" }} />{label}
            </button>
          );
        })}
      </div>

      {tab === "leaderboard" ? (
        <AnagramLeaderboard currentPlayerId={playerId} />
      ) : !game ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
      ) : (
        <GameView
          game={game}
          orderedOuter={orderedOuter}
          input={input}
          onLetter={(l) => setInput((s) => s + l)}
          onDelete={() => setInput((s) => s.slice(0, -1))}
          onShuffle={shuffle}
          onSubmit={submitWord}
          submitting={submitting}
          toast={toast}
          toastError={toastError}
        />
      )}
    </div>
  );
}

function GameView({
  game,
  orderedOuter,
  input,
  onLetter,
  onDelete,
  onShuffle,
  onSubmit,
  submitting,
  toast,
  toastError,
}: {
  game: GameState;
  orderedOuter: string[];
  input: string;
  onLetter: (l: string) => void;
  onDelete: () => void;
  onShuffle: () => void;
  onSubmit: () => void;
  submitting: boolean;
  toast: string | null;
  toastError: boolean;
}) {
  const sorted = useMemo(() => [...game.foundWords].sort(), [game.foundWords]);
  const isPangram = (w: string) => game.letters.every((l) => w.includes(l));
  const required = game.required.toUpperCase();

  return (
    <div className="flex flex-col items-center">
      {/* Rank pill */}
      <div
        className="mb-3.5 inline-flex items-center gap-2 rounded-full px-4 py-2"
        style={{ background: "var(--warning-soft)", border: "1px solid color-mix(in srgb, var(--warning) 45%, transparent)" }}
      >
        <Icon name="workspace_premium" size={17} fill style={{ color: "var(--warning)" }} />
        <span className="text-[13.5px] font-bold" style={{ color: "var(--warning)" }}>
          {game.rank} · {game.score}/{game.maxScore} ({game.pct}%)
        </span>
      </div>

      {/* Word input */}
      <div className="relative w-full">
        <div
          className="flex min-h-[60px] items-center justify-center rounded-[16px] px-4 py-2"
          style={{ border: "1px dashed var(--border-strong)", background: "var(--surface-2)" }}
        >
          {input.length === 0 ? (
            <span className="text-[22px] font-extrabold" style={{ letterSpacing: "0.06em", color: "var(--text-3)", opacity: 0.7 }}>TYPE A WORD…</span>
          ) : (
            <div className="flex items-center">
              {input.toUpperCase().split("").map((ch, i) => (
                <span key={i} className="text-[28px] font-extrabold leading-none" style={{ letterSpacing: "0.04em", color: ch === required ? "var(--warning)" : "var(--text)" }}>{ch}</span>
              ))}
            </div>
          )}
        </div>
        {toast && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow"
            style={{ background: toastError ? "var(--danger)" : "var(--success)" }}
          >
            {toast}
          </div>
        )}
      </div>

      {/* Letter cluster (centre highlighted) */}
      <div className="mx-auto mt-5 grid max-w-[240px] grid-cols-3 gap-2.5">
        <LetterCell letter={orderedOuter[0]} onClick={onLetter} />
        <LetterCell letter={orderedOuter[1]} onClick={onLetter} />
        <span />
        <LetterCell letter={orderedOuter[2]} onClick={onLetter} />
        <LetterCell letter={game.required} onClick={onLetter} required />
        <LetterCell letter={orderedOuter[3]} onClick={onLetter} />
        <span />
        <LetterCell letter={orderedOuter[4]} onClick={onLetter} />
        <LetterCell letter={orderedOuter[5]} onClick={onLetter} />
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-center gap-2.5">
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-[13px] px-4 py-2.5 text-[14px] font-bold active:opacity-90"
          style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
        >
          <Icon name="backspace" size={18} style={{ color: "var(--text)" }} />Delete
        </button>
        <button
          onClick={onShuffle}
          className="inline-flex items-center gap-1.5 rounded-[13px] px-4 py-2.5 text-[14px] font-bold active:opacity-90"
          style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
        >
          <Icon name="refresh" size={18} style={{ color: "var(--text)" }} />Shuffle
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting || input.length < 1}
          className="inline-flex items-center gap-1.5 rounded-[13px] px-[18px] py-2.5 text-[14px] font-bold text-white active:opacity-90 disabled:opacity-40"
          style={{ background: "var(--accent-strong)" }}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Icon name="send" size={18} style={{ color: "#fff" }} />}Enter
        </button>
      </div>

      {/* Found words */}
      <div className="mt-5 w-full rounded-[16px] p-[15px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="mb-2.5 text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
          {sorted.length} {sorted.length === 1 ? "word" : "words"} found
        </p>
        {sorted.length === 0 ? (
          <p className="text-[13.5px] italic" style={{ color: "var(--text-3)" }}>No words yet. Centre letter must appear in every word.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((w) => {
              const p = isPangram(w);
              const label = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
              return (
                <span
                  key={w}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-bold"
                  style={p ? { background: "var(--warning-soft)", color: "var(--warning)", border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)" } : { background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-3.5 text-center text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
        New letters daily at midnight IST · pangrams (use all 7) earn +7 bonus
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
      className="flex h-[68px] items-center justify-center rounded-[16px] text-[26px] font-extrabold uppercase transition-transform active:scale-95"
      style={
        required
          ? { background: "var(--warning)", color: "#1a1206", boxShadow: "0 4px 16px color-mix(in srgb, var(--warning) 45%, transparent)" }
          : { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }
      }
    >
      {letter}
    </button>
  );
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
