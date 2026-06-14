import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import {
  ACTIVE_DIFFICULTY,
  GRID_CONFIG,
  formatTime,
  getDailyCards,
  getStars,
  getTodayIST,
} from "../lib/memory";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import MemoryLeaderboard from "../components/MemoryLeaderboard";

type CardState = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
};

type Tab = "game" | "leaderboard";

const FLIP_DELAY = 800;
const difficulty = ACTIVE_DIFFICULTY;
const config = GRID_CONFIG[difficulty];

function initialCards(today: string): CardState[] {
  return getDailyCards(today, difficulty).map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
  }));
}

export default function MemoryGame() {
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [tab, setTab] = useState<Tab>("game");
  const today = getTodayIST();

  const [cards, setCards] = useState<CardState[]>(() => initialCards(today));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [lockBoard, setLockBoard] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch server-side game state on mount / playerId change.
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/memory/game?playerId=${playerId}&difficulty=${difficulty}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.completed) {
          setCompleted(true);
          setLockBoard(true);
          setMoves(data.moves ?? 0);
          setTimeSeconds(data.timeSeconds ?? 0);
          setCards((prev) => prev.map((c) => ({ ...c, matched: true, flipped: false })));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  useEffect(() => {
    if (!timerActive || completed) return;
    timerRef.current = setInterval(() => {
      setTimeSeconds((t) => t + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, completed]);

  const submitCompletion = useCallback(
    (finalMoves: number, finalTime: number) => {
      if (!playerId) return;
      apiFetch("/api/memory/game", {
        method: "POST",
        body: JSON.stringify({ playerId, difficulty, moves: finalMoves, timeSeconds: finalTime }),
      }).catch(() => {});
    },
    [playerId]
  );

  const handleCardClick = useCallback(
    (index: number) => {
      if (lockBoard || completed) return;
      const card = cards[index];
      if (card.matched || card.flipped) return;

      if (!timerActive && moves === 0 && flipped.length === 0) {
        setTimerActive(true);
      }

      const next = [...cards];
      next[index] = { ...next[index], flipped: true };
      const nextFlipped = [...flipped, index];
      setCards(next);
      setFlipped(nextFlipped);

      if (nextFlipped.length !== 2) return;

      const [first, second] = nextFlipped;
      const newMoves = moves + 1;
      setMoves(newMoves);
      setLockBoard(true);

      if (next[first].emoji === next[second].emoji) {
        setTimeout(() => {
          setCards((prev) => {
            const updated = [...prev];
            updated[first] = { ...updated[first], matched: true, flipped: false };
            updated[second] = { ...updated[second], matched: true, flipped: false };
            if (updated.every((c) => c.matched)) {
              setCompleted(true);
              setTimerActive(false);
              setTimeSeconds((t) => {
                submitCompletion(newMoves, t);
                return t;
              });
            }
            return updated;
          });
          setFlipped([]);
          setLockBoard(false);
        }, 400);
      } else {
        setTimeout(() => {
          setCards((prev) => {
            const updated = [...prev];
            updated[first] = { ...updated[first], flipped: false };
            updated[second] = { ...updated[second], flipped: false };
            return updated;
          });
          setFlipped([]);
          setLockBoard(false);
        }, FLIP_DELAY);
      }
    },
    [cards, completed, flipped, lockBoard, moves, timerActive, submitCompletion]
  );

  const handleRestart = () => {
    if (completed) return; // can't replay a completed daily
    setCards(initialCards(today));
    setFlipped([]);
    setMoves(0);
    setTimeSeconds(0);
    setTimerActive(false);
    setLockBoard(false);
  };

  const stars = completed ? getStars(difficulty, moves) : 0;
  const matchedPairs = cards.filter((c) => c.matched).length / 2;
  const progressPct = config.pairs ? Math.round((matchedPairs / config.pairs) * 100) : 0;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-3">
        <Link to="/games" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text)" }} />
        </Link>
        <h1 className="flex-1 text-center text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Memory Match</h1>
        <Link to="/memory/multi" className="flex active:opacity-70" aria-label="Multiplayer">
          <Icon name="group" size={22} style={{ color: "var(--text)" }} />
        </Link>
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
        <MemoryLeaderboard currentPlayerId={playerId} />
      ) : (
        <GameView
          loading={loading}
          cards={cards}
          moves={moves}
          timeSeconds={timeSeconds}
          completed={completed}
          lockBoard={lockBoard}
          stars={stars}
          progressPct={progressPct}
          onCardClick={handleCardClick}
          onRestart={handleRestart}
          onSeeLeaderboard={() => setTab("leaderboard")}
        />
      )}

      <div className="flex-1" />
    </div>
  );
}

function GameView({
  loading,
  cards,
  moves,
  timeSeconds,
  completed,
  lockBoard,
  stars,
  progressPct,
  onCardClick,
  onRestart,
  onSeeLeaderboard,
}: {
  loading: boolean;
  cards: CardState[];
  moves: number;
  timeSeconds: number;
  completed: boolean;
  lockBoard: boolean;
  stars: number;
  progressPct: number;
  onCardClick: (idx: number) => void;
  onRestart: () => void;
  onSeeLeaderboard: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* Daily challenge pill */}
      <div
        className="mb-3.5 inline-flex items-center gap-2 rounded-full px-4 py-2"
        style={{ background: "var(--warning-soft)", border: "1px solid color-mix(in srgb, var(--warning) 45%, transparent)" }}
      >
        <Icon name="emoji_events" size={17} fill style={{ color: "var(--warning)" }} />
        <span className="text-[13.5px] font-bold" style={{ color: "var(--warning)" }}>Daily Challenge — 5×4 · 10 pairs</span>
      </div>

      {/* Stats */}
      <div className="mb-4 flex items-center gap-7">
        <span className="flex items-center gap-2">
          <Icon name="style" size={18} style={{ color: "var(--text-3)" }} />
          <span className="one-mono text-[17px] font-bold" style={{ color: "var(--text)" }}>{moves}</span>
          <span className="text-[13px]" style={{ color: "var(--text-3)" }}>moves</span>
        </span>
        <span className="flex items-center gap-2">
          <Icon name="schedule" size={18} style={{ color: "var(--text-3)" }} />
          <span className="one-mono text-[17px] font-bold" style={{ color: "var(--text)" }}>{formatTime(timeSeconds)}</span>
          <span className="text-[13px]" style={{ color: "var(--text-3)" }}>time</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, var(--accent-strong), var(--accent))" }} />
      </div>

      {loading ? (
        <div className="py-16 text-[14px]" style={{ color: "var(--text-3)" }}>Loading today's game…</div>
      ) : (
        <div className="grid w-full grid-cols-5 gap-2">
          {cards.map((card, idx) => (
            <Card key={card.id} card={card} disabled={lockBoard || completed} onClick={() => onCardClick(idx)} />
          ))}
        </div>
      )}

      {!completed && !loading && (
        <button
          onClick={onRestart}
          className="mt-[18px] inline-flex items-center gap-2 rounded-[13px] px-[22px] py-2.5 text-[14px] font-bold active:opacity-90"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
        >
          <Icon name="restart_alt" size={18} style={{ color: "var(--text)" }} />Restart
        </button>
      )}

      {completed && (
        <div
          className="mt-[18px] w-full rounded-[18px] p-5 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div className="text-[34px]">🎉</div>
          <h2 className="mt-2 text-[19px] font-extrabold" style={{ color: "var(--text)" }}>Solved!</h2>
          <div className="mt-2.5 flex justify-center gap-1.5">
            {[1, 2, 3].map((i) => (
              <Icon key={i} name="star" size={30} fill={i <= stars} style={{ color: i <= stars ? "var(--star)" : "var(--text-3)" }} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-6">
            <SummaryStat value={String(moves)} label="Moves" />
            <span className="h-8 w-px" style={{ background: "var(--border)" }} />
            <SummaryStat value={formatTime(timeSeconds)} label="Time" />
            <span className="h-8 w-px" style={{ background: "var(--border)" }} />
            <SummaryStat value={String(config.pairs)} label="Optimal" />
          </div>
          <button
            onClick={onSeeLeaderboard}
            className="mt-5 inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-[14px] font-bold text-white active:opacity-90"
            style={{ background: "var(--accent-strong)" }}
          >
            <Icon name="emoji_events" size={18} style={{ color: "#fff" }} />See leaderboard
          </button>
          <p className="mt-3 text-[12px]" style={{ color: "var(--text-3)" }}>New cards at midnight IST</p>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[22px] font-extrabold" style={{ color: "var(--text)" }}>{value}</p>
      <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{label}</p>
    </div>
  );
}

function Card({ card, disabled, onClick }: { card: CardState; disabled: boolean; onClick: () => void }) {
  const revealed = card.flipped || card.matched;
  return (
    <button type="button" disabled={disabled && !revealed} onClick={onClick} className="aspect-square w-full [perspective:500px]">
      <div
        className="relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d]"
        style={{ transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Back (hidden) */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-[14px] [backface-visibility:hidden]"
          style={{ background: "linear-gradient(150deg,#7c7ff2,#6366f1)", boxShadow: "0 3px 9px rgba(99,102,241,0.32)" }}
        >
          <Icon name="star" size={23} style={{ color: "rgba(255,255,255,0.82)" }} />
        </div>
        {/* Front (revealed) */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-[14px] [backface-visibility:hidden]"
          style={{
            transform: "rotateY(180deg)",
            background: card.matched ? "var(--success-soft)" : "var(--surface-3)",
            border: card.matched ? "1px solid color-mix(in srgb, var(--success) 45%, transparent)" : "1px solid var(--border-strong)",
          }}
        >
          <span className="select-none text-[28px]">{card.emoji}</span>
        </div>
      </div>
    </button>
  );
}
