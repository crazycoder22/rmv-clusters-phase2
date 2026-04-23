import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, Layers, RotateCcw, Star, Trophy } from "lucide-react";
import clsx from "clsx";
import {
  ACTIVE_DIFFICULTY,
  GRID_CONFIG,
  formatTime,
  getDailyCards,
  getStars,
  getTodayIST,
} from "../lib/memory";

type CardState = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
};

const FLIP_DELAY = 800;
const difficulty = ACTIVE_DIFFICULTY;
const config = GRID_CONFIG[difficulty];

type BestToday = { moves: number; time: number; date: string };
const BEST_KEY = `memory_best_${difficulty}`;

function loadBestToday(today: string): BestToday | null {
  const raw = localStorage.getItem(BEST_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BestToday;
    return parsed.date === today ? parsed : null;
  } catch {
    return null;
  }
}

function initialCards(today: string): CardState[] {
  return getDailyCards(today, difficulty).map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
  }));
}

export default function MemoryGame() {
  const today = getTodayIST();

  const [cards, setCards] = useState<CardState[]>(() => initialCards(today));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [lockBoard, setLockBoard] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [bestToday, setBestToday] = useState<BestToday | null>(() =>
    loadBestToday(today)
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!timerActive || completed) return;
    timerRef.current = setInterval(() => {
      setTimeSeconds((t) => t + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, completed]);

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
            updated[first] = {
              ...updated[first],
              matched: true,
              flipped: false,
            };
            updated[second] = {
              ...updated[second],
              matched: true,
              flipped: false,
            };
            if (updated.every((c) => c.matched)) {
              setCompleted(true);
              setTimerActive(false);
              setTimeSeconds((t) => {
                const result: BestToday = {
                  moves: newMoves,
                  time: t,
                  date: today,
                };
                const existing = loadBestToday(today);
                const isBetter =
                  !existing ||
                  newMoves < existing.moves ||
                  (newMoves === existing.moves && t < existing.time);
                if (isBetter) {
                  localStorage.setItem(BEST_KEY, JSON.stringify(result));
                  setBestToday(result);
                } else {
                  setBestToday(existing);
                }
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
    [cards, completed, flipped, lockBoard, moves, timerActive, today]
  );

  const handleNewGame = () => {
    setCards(initialCards(today));
    setFlipped([]);
    setMoves(0);
    setTimeSeconds(0);
    setTimerActive(false);
    setLockBoard(false);
    setCompleted(false);
  };

  const stars = completed ? getStars(difficulty, moves) : 0;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Memory Match</h1>
        <div className="h-9 w-9" />
      </header>

      <div className="mx-auto mb-4 inline-flex items-center gap-1.5 self-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
        <Trophy size={12} />
        Daily Challenge — 5×4 · 10 pairs
      </div>

      <div className="mb-5 flex items-center justify-center gap-6 text-sm">
        <Stat icon={<Layers size={15} />} label="moves" value={String(moves)} />
        <Stat
          icon={<Clock size={15} />}
          label="time"
          value={formatTime(timeSeconds)}
        />
        {bestToday && (
          <Stat
            icon={<Trophy size={14} className="text-yellow-400" />}
            label="best"
            value={`${bestToday.moves}m / ${formatTime(bestToday.time)}`}
          />
        )}
      </div>

      <div className="mx-auto grid w-full max-w-sm flex-shrink-0 grid-cols-5 gap-2">
        {cards.map((card, idx) => (
          <Card
            key={card.id}
            card={card}
            disabled={lockBoard || completed}
            onClick={() => handleCardClick(idx)}
          />
        ))}
      </div>

      {!completed && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleNewGame}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 active:bg-slate-700"
          >
            <RotateCcw size={15} />
            Restart
          </button>
        </div>
      )}

      {completed && (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/80 p-6 text-center shadow-lg">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-3 text-xl font-bold text-white">
            Congratulations!
          </h2>
          <div className="mt-3 flex justify-center gap-1">
            {[1, 2, 3].map((i) => (
              <Star
                key={i}
                size={32}
                className={clsx(
                  "transition-all duration-300",
                  i <= stars
                    ? "fill-yellow-400 text-yellow-400 drop-shadow-sm"
                    : "text-slate-600"
                )}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <SummaryStat value={String(moves)} label="Moves" />
            <Divider />
            <SummaryStat value={formatTime(timeSeconds)} label="Time" />
            <Divider />
            <SummaryStat value={String(config.pairs)} label="Optimal" />
          </div>
          <button
            onClick={handleNewGame}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white active:bg-indigo-600"
          >
            <RotateCcw size={15} />
            Play again
          </button>
          <p className="mt-3 text-xs text-slate-500">New cards at midnight IST</p>
        </div>
      )}

      <div className="flex-1" />
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="font-mono font-semibold text-slate-200">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-slate-700" />;
}

function Card({
  card,
  disabled,
  onClick,
}: {
  card: CardState;
  disabled: boolean;
  onClick: () => void;
}) {
  const revealed = card.flipped || card.matched;
  return (
    <button
      type="button"
      disabled={disabled && !revealed}
      onClick={onClick}
      className="aspect-square w-full [perspective:500px]"
    >
      <div
        className="relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d]"
        style={{
          transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-indigo-400/60 bg-gradient-to-br from-indigo-500 to-indigo-700 [backface-visibility:hidden]"
        >
          <Star className="text-white/50" size={24} />
        </div>
        <div
          className={clsx(
            "absolute inset-0 flex items-center justify-center rounded-xl border-2 [backface-visibility:hidden]",
            card.matched
              ? "scale-[1.03] border-green-400 bg-green-500/20 shadow-md shadow-green-500/20"
              : "border-slate-600 bg-slate-100"
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
          <span className="select-none text-3xl">{card.emoji}</span>
        </div>
      </div>
    </button>
  );
}
