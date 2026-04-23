import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Layers,
  RotateCcw,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import clsx from "clsx";
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
  const [bestToday, setBestToday] = useState<{ moves: number; time: number } | null>(null);
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
          setBestToday({ moves: data.moves, time: data.timeSeconds ?? 0 });
          setCards((prev) =>
            prev.map((c) => ({ ...c, matched: true, flipped: false }))
          );
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
        body: JSON.stringify({
          playerId,
          difficulty,
          moves: finalMoves,
          timeSeconds: finalTime,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(() => {
          setBestToday({ moves: finalMoves, time: finalTime });
        })
        .catch(() => {});
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
        <Link
          to="/memory/multi"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
          title="Multiplayer"
        >
          <Users size={18} />
        </Link>
      </header>

      <div className="mb-4 flex justify-center">
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
        <MemoryLeaderboard currentPlayerId={playerId} />
      ) : (
        <GameView
          loading={loading}
          cards={cards}
          moves={moves}
          timeSeconds={timeSeconds}
          bestToday={bestToday}
          completed={completed}
          lockBoard={lockBoard}
          stars={stars}
          onCardClick={handleCardClick}
          onRestart={handleRestart}
          onSeeLeaderboard={() => setTab("leaderboard")}
        />
      )}

      <div className="flex-1" />
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

function GameView({
  loading,
  cards,
  moves,
  timeSeconds,
  bestToday,
  completed,
  lockBoard,
  stars,
  onCardClick,
  onRestart,
  onSeeLeaderboard,
}: {
  loading: boolean;
  cards: CardState[];
  moves: number;
  timeSeconds: number;
  bestToday: { moves: number; time: number } | null;
  completed: boolean;
  lockBoard: boolean;
  stars: number;
  onCardClick: (idx: number) => void;
  onRestart: () => void;
  onSeeLeaderboard: () => void;
}) {
  return (
    <>
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

      {loading ? (
        <div className="flex justify-center py-16 text-sm text-slate-500">
          Loading today's game…
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-sm flex-shrink-0 grid-cols-5 gap-2">
          {cards.map((card, idx) => (
            <Card
              key={card.id}
              card={card}
              disabled={lockBoard || completed}
              onClick={() => onCardClick(idx)}
            />
          ))}
        </div>
      )}

      {!completed && !loading && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onRestart}
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
          <h2 className="mt-3 text-xl font-bold text-white">Congratulations!</h2>
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
            onClick={onSeeLeaderboard}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white active:bg-indigo-600"
          >
            <Trophy size={15} />
            See leaderboard
          </button>
          <p className="mt-3 text-xs text-slate-500">New cards at midnight IST</p>
        </div>
      )}
    </>
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
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-indigo-400/60 bg-gradient-to-br from-indigo-500 to-indigo-700 [backface-visibility:hidden]">
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
