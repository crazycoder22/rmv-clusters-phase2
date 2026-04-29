import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Crown,
  Delete as DeleteIcon,
  Layers,
  Loader2,
  RotateCcw,
  Send,
  Trophy,
} from "lucide-react";
import clsx from "clsx";
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
        flashToast(
          data.isPangram ? `🌟 Pangram +${data.score}` : `+${data.score}`
        );
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
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Link
            to="/games"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-white">Anagram</h1>
        </div>
      </header>

      <div className="mb-4 flex justify-center">
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <TabBtn active={tab === "game"} onClick={() => setTab("game")}>
            <Layers size={14} /> Game
          </TabBtn>
          <TabBtn
            active={tab === "leaderboard"}
            onClick={() => setTab("leaderboard")}
          >
            <Trophy size={14} /> Leaderboard
          </TabBtn>
        </div>
      </div>

      {tab === "leaderboard" ? (
        <AnagramLeaderboard currentPlayerId={playerId} />
      ) : !game ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
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

function TabBtn({
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

  return (
    <div className="space-y-4">
      {/* Score chip */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
          <Crown size={12} className="text-amber-400" />
          <span className="text-xs font-semibold text-amber-200">
            {game.rank}
          </span>
          <span className="text-[11px] text-amber-300/80">
            · {game.score}/{game.maxScore} ({game.pct}%)
          </span>
        </div>
      </div>

      {/* Input */}
      <div className="relative">
        <div
          className={clsx(
            "h-12 rounded-xl border-2 bg-slate-900 flex items-center justify-center text-xl font-bold uppercase tracking-widest transition-colors",
            input.length === 0
              ? "border-slate-700 text-slate-600"
              : "border-indigo-400 text-white"
          )}
        >
          {input || "type a word…"}
        </div>
        {toast && (
          <div
            className={clsx(
              "absolute left-1/2 -translate-x-1/2 -top-3 text-[11px] font-bold px-3 py-1 rounded-full shadow",
              toastError ? "bg-red-500 text-white" : "bg-green-500 text-white"
            )}
          >
            {toast}
          </div>
        )}
      </div>

      {/* Letter hex (3-col grid, required at centre) */}
      <div className="mx-auto grid grid-cols-3 gap-2 max-w-[240px]">
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

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onDelete}
          className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-300 active:bg-slate-700 inline-flex items-center gap-1"
        >
          <DeleteIcon size={12} />
          Delete
        </button>
        <button
          onClick={onShuffle}
          className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-300 active:bg-slate-700 inline-flex items-center gap-1"
        >
          <RotateCcw size={12} />
          Shuffle
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting || input.length < 1}
          className="px-4 py-2 rounded-lg bg-indigo-500 text-xs font-semibold text-white active:bg-indigo-600 disabled:opacity-40 inline-flex items-center gap-1"
        >
          {submitting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
          Enter
        </button>
      </div>

      {/* Found words */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
        <p className="text-xs font-semibold text-slate-200 mb-2">
          {sorted.length} {sorted.length === 1 ? "word" : "words"} found
        </p>
        {sorted.length === 0 ? (
          <p className="text-xs italic text-slate-500">
            No words yet. Centre letter must appear in every word.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((w) => {
              const p = isPangram(w);
              return (
                <span
                  key={w}
                  className={clsx(
                    "inline-block px-2 py-0.5 rounded text-xs",
                    p
                      ? "bg-amber-500/30 text-amber-200 font-bold"
                      : "bg-slate-700 text-slate-300"
                  )}
                >
                  {w}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-slate-500">
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
      className={clsx(
        "h-16 rounded-xl text-2xl font-extrabold uppercase transition-transform active:scale-95",
        required
          ? "bg-amber-400 text-amber-950 shadow-md shadow-amber-500/30"
          : "bg-slate-700 text-slate-100 active:bg-slate-600"
      )}
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
