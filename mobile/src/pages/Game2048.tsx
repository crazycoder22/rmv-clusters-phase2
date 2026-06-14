import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
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
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
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
        <h1 className="text-[18px] font-bold" style={{ color: "var(--text)" }}>2048</h1>
        <div className="h-9 w-9" />
      </header>

      {/* Game / Leaderboard segmented */}
      <div className="mb-4 flex justify-center">
        <div
          className="flex rounded-[12px] p-1"
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
        <Game2048Leaderboard currentPlayerId={playerId} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <ScoreCard label="SCORE" value={score} />
            <ScoreCard label="BEST" value={best} />
            <ScoreCard label="MOVES" value={moves} />
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              className="grid aspect-square w-full grid-cols-4 gap-2.5 rounded-[16px] p-2.5 touch-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {board.flat().map((v, i) => (
                <Tile key={i} value={v} />
              ))}
            </div>

            {over && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-[16px] px-6 text-center"
                style={{ background: "rgba(10,15,28,0.82)", backdropFilter: "blur(2px)" }}
              >
                <div className="text-[40px]">{won ? "🏆" : "💥"}</div>
                <h2 className="text-[22px] font-extrabold text-white">
                  {won ? "You reached 2048!" : "Game over"}
                </h2>
                <p className="mt-1 text-[13.5px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Final score{" "}
                  <span className="one-mono font-bold text-white">{score}</span> · Best tile{" "}
                  <span className="one-mono font-bold text-white">{highestTile}</span>
                </p>
                <button
                  onClick={handleRestart}
                  className="mt-4 inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-[14px] font-bold text-white"
                  style={{ background: "var(--accent-strong)" }}
                >
                  <Icon name="refresh" size={16} />
                  New Game
                </button>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-[12px]" style={{ color: "var(--text-3)" }}>
            Swipe to move tiles. Merge matching tiles to build 2048.
          </p>

          <div className="mt-4 flex justify-center">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-[14px] font-bold"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
            >
              <Icon name="refresh" size={16} />
              New Game
            </button>
          </div>

          {won && !over && (
            <p className="mt-3 text-center text-[13px] font-semibold" style={{ color: "var(--warning)" }}>
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
      className="flex items-center gap-1.5 rounded-[9px] px-[18px] py-[7px] text-[13.5px] font-bold transition-colors"
      style={active ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" } : { background: "transparent", color: "var(--text-3)" }}
    >
      <Icon name={icon} size={15} />
      {children}
    </button>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-[12px] px-3 py-2.5 text-center"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <p className="one-mono text-[10px] font-bold tracking-wider" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <p className="one-mono text-[19px] font-bold" style={{ color: "var(--text)" }}>{value}</p>
    </div>
  );
}

// Classic 2048 tile palette — kept across themes so the board reads as 2048.
const TILE_STYLES: Record<number, { bg: string; fg: string }> = {
  2: { bg: "#eee4da", fg: "#776e65" },
  4: { bg: "#ede0c8", fg: "#776e65" },
  8: { bg: "#f2b179", fg: "#ffffff" },
  16: { bg: "#f59563", fg: "#ffffff" },
  32: { bg: "#f67c5f", fg: "#ffffff" },
  64: { bg: "#f65e3b", fg: "#ffffff" },
  128: { bg: "#edcf72", fg: "#ffffff" },
  256: { bg: "#edcc61", fg: "#ffffff" },
  512: { bg: "#edc850", fg: "#ffffff" },
  1024: { bg: "#edc53f", fg: "#ffffff" },
  2048: { bg: "#edc22e", fg: "#ffffff" },
};

function Tile({ value }: { value: number }) {
  const tile = value === 0 ? null : (TILE_STYLES[value] ?? { bg: "#3c3a32", fg: "#ffffff" });
  const size =
    value >= 1024
      ? "text-[20px]"
      : value >= 128
        ? "text-[24px]"
        : value >= 16
          ? "text-[28px]"
          : "text-[32px]";
  return (
    <div
      className={`flex aspect-square items-center justify-center rounded-[10px] font-bold select-none ${size}`}
      style={tile ? { background: tile.bg, color: tile.fg } : { background: "var(--surface-3)" }}
    >
      {value !== 0 ? value : ""}
    </div>
  );
}
