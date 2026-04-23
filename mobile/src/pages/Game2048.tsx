import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Layers, RotateCcw, Trophy } from "lucide-react";
import clsx from "clsx";
import {
  type Board,
  type Direction,
  WIN_TILE,
  createBoard,
  getHighestTile,
  isGameOver,
  move,
  spawnTile,
} from "../lib/game2048";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import Game2048Leaderboard from "../components/Game2048Leaderboard";

type Tab = "game" | "leaderboard";

const SWIPE_THRESHOLD = 30; // px

export default function Game2048() {
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [tab, setTab] = useState<Tab>("game");
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() =>
    Number(localStorage.getItem("2048_best") || 0)
  );
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState<number>(Date.now());
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const highestTile = getHighestTile(board);

  const submitRun = useCallback(
    (finalScore: number, finalBoard: Board, finalMoves: number) => {
      if (!playerId || submitted) return;
      setSubmitted(true);
      const duration = Math.round((Date.now() - started) / 1000);
      apiFetch("/api/2048/run", {
        method: "POST",
        body: JSON.stringify({
          playerId,
          score: finalScore,
          highestTile: getHighestTile(finalBoard),
          moves: finalMoves,
          duration,
        }),
      }).catch(() => {
        /* swallow — local state still good */
      });
    },
    [playerId, started, submitted]
  );

  const handleMove = useCallback(
    (dir: Direction) => {
      if (over) return;
      const result = move(board, dir);
      if (!result.moved) return;
      spawnTile(result.board);
      const nextScore = score + result.gained;
      const nextMoves = moves + 1;
      setBoard(result.board);
      setScore(nextScore);
      setMoves(nextMoves);
      if (nextScore > best) {
        setBest(nextScore);
        localStorage.setItem("2048_best", String(nextScore));
      }
      const nextHighest = getHighestTile(result.board);
      if (!won && nextHighest >= WIN_TILE) {
        setWon(true);
      }
      if (isGameOver(result.board)) {
        setOver(true);
        submitRun(nextScore, result.board, nextMoves);
      }
    },
    [board, score, moves, over, best, won, submitRun]
  );

  const handleRestart = useCallback(() => {
    // If current run had any moves and isn't over yet, submit as an abandoned
    // run so it still counts.
    if (!over && moves > 0) submitRun(score, board, moves);
    setBoard(createBoard());
    setScore(0);
    setMoves(0);
    setOver(false);
    setWon(false);
    setSubmitted(false);
    setStarted(Date.now());
  }, [over, moves, score, board, submitRun]);

  // Keyboard support (browser dev).
  useEffect(() => {
    if (tab !== "game") return;
    const handler = (e: KeyboardEvent) => {
      let dir: Direction | null = null;
      if (e.key === "ArrowUp") dir = "up";
      else if (e.key === "ArrowDown") dir = "down";
      else if (e.key === "ArrowLeft") dir = "left";
      else if (e.key === "ArrowRight") dir = "right";
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, handleMove]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? "right" : "left");
    } else {
      handleMove(dy > 0 ? "down" : "up");
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">2048</h1>
        <div className="h-9 w-9" />
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
        <Game2048Leaderboard currentPlayerId={playerId} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <ScoreCard label="SCORE" value={score} />
            <ScoreCard label="BEST" value={best} />
            <ScoreCard label="MOVES" value={moves} />
          </div>

          <div
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="mx-auto grid aspect-square w-full max-w-sm grid-cols-4 gap-2 rounded-xl border border-slate-700 bg-slate-800 p-2 touch-none"
          >
            {board.flat().map((v, i) => (
              <Tile key={i} value={v} />
            ))}
          </div>

          <p className="mt-3 text-center text-xs text-slate-500">
            Swipe to move tiles. Merge matching tiles to build 2048.
          </p>

          <div className="mt-4 flex justify-center">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 active:bg-slate-700"
            >
              <RotateCcw size={15} />
              New Game
            </button>
          </div>

          {over && (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800/80 p-5 text-center">
              <div className="text-4xl">{won ? "🏆" : "💥"}</div>
              <h2 className="mt-2 text-xl font-bold text-white">
                {won ? "You reached 2048!" : "Game Over"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Score <span className="font-mono font-bold">{score}</span> · Best
                tile <span className="font-mono font-bold">{highestTile}</span>
              </p>
              <button
                onClick={handleRestart}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white active:bg-indigo-600"
              >
                <RotateCcw size={14} />
                Play again
              </button>
            </div>
          )}

          {won && !over && (
            <p className="mt-3 text-center text-sm text-amber-300">
              You reached 2048! Keep going for a higher score.
            </p>
          )}
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

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2 text-center">
      <p className="text-[10px] font-bold tracking-wider text-slate-500">
        {label}
      </p>
      <p className="font-mono text-lg font-bold text-white">{value}</p>
    </div>
  );
}

const TILE_STYLES: Record<number, string> = {
  0: "bg-slate-700/60",
  2: "bg-[#eee4da] text-[#776e65]",
  4: "bg-[#ede0c8] text-[#776e65]",
  8: "bg-[#f2b179] text-white",
  16: "bg-[#f59563] text-white",
  32: "bg-[#f67c5f] text-white",
  64: "bg-[#f65e3b] text-white",
  128: "bg-[#edcf72] text-white",
  256: "bg-[#edcc61] text-white",
  512: "bg-[#edc850] text-white",
  1024: "bg-[#edc53f] text-white",
  2048: "bg-[#edc22e] text-white",
};

function Tile({ value }: { value: number }) {
  const cls = TILE_STYLES[value] ?? "bg-black text-white";
  const size =
    value >= 1024
      ? "text-xl"
      : value >= 128
        ? "text-2xl"
        : value >= 16
          ? "text-3xl"
          : "text-4xl";
  return (
    <div
      className={clsx(
        "flex aspect-square items-center justify-center rounded-md font-bold select-none",
        cls,
        size
      )}
    >
      {value !== 0 ? value : ""}
    </div>
  );
}
