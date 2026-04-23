import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, Delete, Layers, Trophy } from "lucide-react";
import clsx from "clsx";
import {
  type Difficulty,
  formatTime,
  getErrorCells,
  getPeerIndices,
} from "../lib/sudoku";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import SudokuLeaderboard from "../components/SudokuLeaderboard";

type Tab = "game" | "leaderboard";
const EMPTY_GRID: number[] = Array(81).fill(0);

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function Sudoku() {
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [tab, setTab] = useState<Tab>("game");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [puzzle, setPuzzle] = useState<number[]>(EMPTY_GRID);
  const [grid, setGrid] = useState<number[]>(EMPTY_GRID);
  const [selected, setSelected] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [savedTime, setSavedTime] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);

  const [timeSeconds, setTimeSeconds] = useState(0);
  const savedTimeOffset = useRef(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch game state whenever playerId / difficulty changes.
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setGameLoading(true);
    setSelected(null);
    apiFetch(`/api/sudoku/game?playerId=${playerId}&difficulty=${difficulty}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setPuzzle(data.puzzle);
        setGrid(data.currentGrid);
        setCompleted(!!data.completed);
        setSavedTime(data.timeSeconds ?? null);
        setSubmitError(false);
        savedTimeOffset.current = data.timeSeconds ?? 0;
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGameLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, difficulty]);

  // Timer (pauses on completion).
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (completed || !playerId || gameLoading) return;
    startTimeRef.current = Date.now();
    setTimeSeconds(savedTimeOffset.current);
    timerRef.current = setInterval(() => {
      const session = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTimeSeconds(savedTimeOffset.current + session);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [completed, playerId, difficulty, gameLoading]);

  const getElapsed = useCallback(() => {
    const session = Math.floor((Date.now() - startTimeRef.current) / 1000);
    return savedTimeOffset.current + session;
  }, []);

  const saveProgress = useCallback(
    (newGrid: number[]) => {
      if (!playerId || completed) return;
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        apiFetch("/api/sudoku/game", {
          method: "POST",
          body: JSON.stringify({
            playerId,
            difficulty,
            currentGrid: newGrid,
            timeSeconds: getElapsed(),
          }),
        }).catch(() => {});
      }, 800);
    },
    [playerId, difficulty, completed, getElapsed]
  );

  const handleSubmit = useCallback(async () => {
    if (!playerId || completed) return;
    const elapsed = getElapsed();
    try {
      const res = await apiFetch("/api/sudoku/game", {
        method: "POST",
        body: JSON.stringify({
          playerId,
          difficulty,
          currentGrid: grid,
          timeSeconds: elapsed,
          action: "submit",
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.completed) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCompleted(true);
        setSavedTime(elapsed);
        setSubmitError(false);
      } else {
        setSubmitError(true);
      }
    } catch {
      /* swallow */
    }
  }, [playerId, difficulty, grid, completed, getElapsed]);

  const handleReset = useCallback(async () => {
    if (!playerId) return;
    try {
      const res = await apiFetch("/api/sudoku/game", {
        method: "POST",
        body: JSON.stringify({ playerId, difficulty, action: "reset" }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setGrid(data.currentGrid);
      setCompleted(false);
      setSavedTime(null);
      setSubmitError(false);
      setSelected(null);
      savedTimeOffset.current = 0;
      startTimeRef.current = Date.now();
      setTimeSeconds(0);
    } catch {
      /* swallow */
    }
  }, [playerId, difficulty]);

  const handleNumber = useCallback(
    (n: number) => {
      if (selected === null || completed) return;
      if (puzzle[selected] !== 0) return;
      const next = [...grid];
      next[selected] = n;
      setGrid(next);
      setSubmitError(false);
      saveProgress(next);
    },
    [selected, completed, puzzle, grid, saveProgress]
  );

  const handleErase = useCallback(() => {
    if (selected === null || completed) return;
    if (puzzle[selected] !== 0) return;
    const next = [...grid];
    next[selected] = 0;
    setGrid(next);
    setSubmitError(false);
    saveProgress(next);
  }, [selected, completed, puzzle, grid, saveProgress]);

  // Hardware keyboard support (helpful for browser dev).
  useEffect(() => {
    if (tab !== "game") return;
    const handler = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) handleNumber(parseInt(e.key));
      if (e.key === "Backspace" || e.key === "Delete") handleErase();
      if (selected !== null) {
        const row = Math.floor(selected / 9);
        const col = selected % 9;
        if (e.key === "ArrowUp" && row > 0) setSelected(selected - 9);
        if (e.key === "ArrowDown" && row < 8) setSelected(selected + 9);
        if (e.key === "ArrowLeft" && col > 0) setSelected(selected - 1);
        if (e.key === "ArrowRight" && col < 8) setSelected(selected + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, handleNumber, handleErase, selected]);

  return (
    <div className="flex flex-1 flex-col px-3 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Sudoku</h1>
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
        <SudokuLeaderboard
          currentPlayerId={playerId}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
        />
      ) : (
        <>
          <div className="mb-3 flex justify-center gap-2">
            {DIFFICULTIES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDifficulty(value)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  difficulty === value
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {gameLoading ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Loading puzzle…
            </div>
          ) : (
            <>
              {!completed && (
                <div className="mb-3 flex items-center justify-center gap-1.5 text-slate-400">
                  <Clock size={15} />
                  <span className="font-mono text-sm">
                    {formatTime(timeSeconds)}
                  </span>
                </div>
              )}

              <Grid
                puzzle={puzzle}
                grid={grid}
                selected={selected}
                completed={completed}
                onCellClick={(i) => !completed && setSelected(i)}
              />

              {completed ? (
                <div className="mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-center">
                  <p className="text-lg font-semibold text-green-300">
                    🎉 Puzzle Complete!
                  </p>
                  <p className="mt-1 text-sm text-green-200/80">
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}{" "}
                    ·{" "}
                    <span className="font-mono font-bold">
                      {formatTime(savedTime ?? 0)}
                    </span>
                  </p>
                  <button
                    onClick={() => setTab("leaderboard")}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white active:bg-indigo-600"
                  >
                    <Trophy size={14} />
                    See Leaderboard
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <NumberPad
                      onNumber={handleNumber}
                      onErase={handleErase}
                      disabled={completed}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={handleSubmit}
                      disabled={grid.some((v) => v === 0)}
                      className="rounded-lg bg-green-500 px-5 py-2 text-sm font-semibold text-white transition-colors active:bg-green-600 disabled:opacity-40"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "Reset puzzle? All progress will be cleared and the timer restarted."
                          )
                        ) {
                          void handleReset();
                        }
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 active:bg-slate-700"
                    >
                      Reset
                    </button>
                  </div>

                  {submitError && (
                    <p className="mt-3 text-center text-sm text-red-400">
                      Not quite right — some cells have errors. Check rows,
                      columns, and boxes for duplicates.
                    </p>
                  )}
                </>
              )}
            </>
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

function Grid({
  puzzle,
  grid,
  selected,
  completed,
  onCellClick,
}: {
  puzzle: number[];
  grid: number[];
  selected: number | null;
  completed: boolean;
  onCellClick: (idx: number) => void;
}) {
  const peers = selected !== null ? getPeerIndices(selected) : new Set<number>();
  const errors = getErrorCells(grid, puzzle);

  return (
    <div className="mx-auto grid w-full max-w-sm grid-cols-9 border-2 border-slate-300">
      {grid.map((val, idx) => {
        const row = Math.floor(idx / 9);
        const col = idx % 9;
        const isLocked = puzzle[idx] !== 0;
        const isSelected = idx === selected;
        const isError = errors.has(idx);
        const isPeer = peers.has(idx);
        return (
          <div
            key={idx}
            onClick={() => onCellClick(idx)}
            className={clsx(
              "flex aspect-square cursor-pointer select-none items-center justify-center text-base transition-colors",
              // Thin borders between all cells
              "border border-slate-600",
              // Thicker borders between 3×3 boxes
              col % 3 === 0 && "border-l-2 border-l-slate-300",
              col === 8 && "border-r-2 border-r-slate-300",
              row % 3 === 0 && "border-t-2 border-t-slate-300",
              row === 8 && "border-b-2 border-b-slate-300",
              // Backgrounds
              completed && "bg-green-500/20 text-green-200",
              !completed && isSelected && "bg-indigo-500 text-white",
              !completed && !isSelected && isError && "bg-red-500/30 text-red-300",
              !completed && !isSelected && !isError && isPeer && "bg-indigo-500/10",
              !completed && !isSelected && !isError && !isPeer && isLocked && "bg-slate-800/80 text-white",
              !completed && !isSelected && !isError && !isPeer && !isLocked && "bg-slate-900 text-indigo-300",
              isLocked && !isSelected && !isError && "font-bold"
            )}
          >
            {val !== 0 ? val : ""}
          </div>
        );
      })}
    </div>
  );
}

function NumberPad({
  onNumber,
  onErase,
  disabled,
}: {
  onNumber: (n: number) => void;
  onErase: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="mx-auto grid w-full max-w-sm grid-cols-9 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => onNumber(n)}
            disabled={disabled}
            className="flex aspect-square items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-base font-semibold text-slate-100 transition-colors active:bg-indigo-500 disabled:opacity-40"
          >
            {n}
          </button>
        ))}
      </div>
      <button
        onClick={onErase}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-sm text-slate-300 active:bg-red-500/20 active:text-red-300 disabled:opacity-40"
      >
        <Delete size={15} />
        Erase
      </button>
    </div>
  );
}
