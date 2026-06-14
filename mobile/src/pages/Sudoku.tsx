import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
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
        <h1 className="text-[18px] font-bold" style={{ color: "var(--text)" }}>Sudoku</h1>
        <div className="h-9 w-9" />
      </header>

      {/* Game / Leaderboard segmented */}
      <div className="mb-4 flex justify-center">
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
        <SudokuLeaderboard
          currentPlayerId={playerId}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
        />
      ) : (
        <div className="flex flex-col items-center">
          {/* difficulty */}
          <div className="mb-3 flex gap-2.5">
            {DIFFICULTIES.map(({ value, label }) => {
              const on = difficulty === value;
              return (
                <button
                  key={value}
                  onClick={() => setDifficulty(value)}
                  className="rounded-full px-[18px] py-2 text-[13.5px] font-bold transition-colors"
                  style={on ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 2px 10px rgba(99,102,241,0.4)" } : { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {gameLoading ? (
            <div className="py-16 text-center text-[14px]" style={{ color: "var(--text-3)" }}>
              Loading puzzle…
            </div>
          ) : (
            <>
              {/* timer */}
              {!completed && (
                <div className="mb-3.5 flex items-center gap-2">
                  <Icon name="schedule" size={18} style={{ color: "var(--text-3)" }} />
                  <span className="one-mono text-[17px] font-bold" style={{ color: "var(--text-2)" }}>
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
                <div
                  className="mt-5 w-full rounded-[16px] p-5 text-center"
                  style={{ background: "var(--success-soft)", border: "1px solid var(--success)" }}
                >
                  <p className="text-[18px] font-extrabold" style={{ color: "var(--success)" }}>
                    🎉 Puzzle complete!
                  </p>
                  <p className="mt-1 text-[14px]" style={{ color: "var(--text-2)" }}>
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} ·{" "}
                    <span className="one-mono font-bold">{formatTime(savedTime ?? 0)}</span>
                  </p>
                  <button
                    onClick={() => setTab("leaderboard")}
                    className="mt-4 inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-[14px] font-bold text-white"
                    style={{ background: "var(--accent-strong)" }}
                  >
                    <Icon name="emoji_events" size={16} />
                    See leaderboard
                  </button>
                </div>
              ) : (
                <>
                  {/* feedback */}
                  <div className="flex h-[22px] items-center justify-center">
                    {submitError && (
                      <span className="text-[13.5px] font-bold" style={{ color: "#f87171" }}>
                        Some numbers conflict — check the red cells.
                      </span>
                    )}
                  </div>

                  {/* number pad */}
                  <div className="grid w-full grid-cols-9 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleNumber(n)}
                        className="flex aspect-square items-center justify-center rounded-[11px] text-[17px] font-bold"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  {/* erase */}
                  <button
                    onClick={handleErase}
                    className="mt-3 inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-[14px] font-bold"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
                  >
                    <Icon name="backspace" size={18} />
                    Erase
                  </button>

                  {/* submit / reset */}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={handleSubmit}
                      disabled={grid.some((v) => v === 0)}
                      className="rounded-[12px] px-8 py-3 text-[15px] font-bold text-white transition-opacity disabled:opacity-40"
                      style={{ background: "var(--success)" }}
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
                      className="rounded-[12px] px-7 py-3 text-[15px] font-bold"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
                    >
                      Reset
                    </button>
                  </div>
                </>
              )}
            </>
          )}
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
  const selVal = selected !== null ? grid[selected] : 0;

  return (
    <div
      className="grid w-full max-w-sm grid-cols-9 overflow-hidden rounded-[8px]"
      style={{ border: "2px solid var(--strong)", background: "var(--surface)" }}
    >
      {grid.map((val, idx) => {
        const row = Math.floor(idx / 9);
        const col = idx % 9;
        const isLocked = puzzle[idx] !== 0;
        const isSelected = idx === selected;
        const isError = errors.has(idx);
        const isPeer = peers.has(idx);
        const sameVal = !!selVal && val === selVal;

        let background = "transparent";
        if (completed) background = "var(--success-soft)";
        else if (isError) background = "rgba(248,113,113,0.20)";
        else if (isSelected) background = "var(--accent-soft)";
        else if (sameVal) background = "rgba(124,127,242,0.16)";
        else if (isPeer) background = "rgba(124,127,242,0.07)";

        let color = isLocked ? "var(--text)" : "var(--accent)";
        if (completed) color = "var(--success)";
        else if (isError) color = "#f87171";

        const borderRight =
          col === 8 ? "none" : col % 3 === 2 ? "2px solid var(--strong)" : "1px solid var(--line)";
        const borderBottom =
          row === 8 ? "none" : row % 3 === 2 ? "2px solid var(--strong)" : "1px solid var(--line)";

        return (
          <div
            key={idx}
            onClick={() => onCellClick(idx)}
            className="flex aspect-square cursor-pointer select-none items-center justify-center text-[17px]"
            style={{
              background,
              color,
              fontWeight: isLocked ? 800 : 700,
              borderRight,
              borderBottom,
            }}
          >
            {val !== 0 ? val : ""}
          </div>
        );
      })}
    </div>
  );
}
