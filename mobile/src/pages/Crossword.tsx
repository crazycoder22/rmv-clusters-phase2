import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import CrosswordLeaderboard from "../components/CrosswordLeaderboard";

type Tab = "game" | "leaderboard";
type Dir = "across" | "down";
type Cell = [number, number];

interface Clue {
  number: number;
  direction: Dir;
  clue: string;
  answer?: string;
  cells: Cell[];
}

const KEYBOARD_ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m", "⌫"],
];

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function Crossword() {
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [tab, setTab] = useState<Tab>("game");
  const [loading, setLoading] = useState(true);

  const [grid, setGrid] = useState<string[][]>([]); // template: "" white, "." black
  const [cellNumbers, setCellNumbers] = useState<number[][]>([]);
  const [clues, setClues] = useState<Clue[]>([]);
  const [currentGrid, setCurrentGrid] = useState<string[][]>([]);
  const [solution, setSolution] = useState<string[][] | null>(null);
  const [completed, setCompleted] = useState(false);
  const [timeSeconds, setTimeSeconds] = useState(0);

  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [selectedDir, setSelectedDir] = useState<Dir>("across");
  const [toast, setToast] = useState<string | null>(null);

  const startedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const timeRef = useRef(0);
  useEffect(() => { completedRef.current = completed; }, [completed]);
  useEffect(() => { timeRef.current = timeSeconds; }, [timeSeconds]);

  // ── Load today's game ──
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/crossword/game?playerId=${playerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setGrid(data.grid);
        setCellNumbers(data.cellNumbers);
        setClues(data.clues);
        setCurrentGrid(data.currentGrid);
        setSolution(data.solution ?? null);
        setCompleted(!!data.completed);
        setTimeSeconds(data.timeSeconds ?? 0);
        // Pre-select the first across clue's first cell.
        const firstAcross = (data.clues as Clue[]).find((c) => c.direction === "across") ?? (data.clues as Clue[])[0];
        if (firstAcross) {
          setSelectedDir(firstAcross.direction);
          setSelectedCell(firstAcross.cells[0]);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveRef.current) clearTimeout(saveRef.current);
    };
  }, [playerId]);

  // Start the live timer on first interaction (mirrors web behaviour).
  const startTimer = useCallback(() => {
    if (startedRef.current || completedRef.current) return;
    startedRef.current = true;
    timerRef.current = setInterval(() => {
      if (completedRef.current) return;
      setTimeSeconds((t) => t + 1);
    }, 1000);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  // ── Active clue / highlighted word ──
  const activeClue: Clue | null = (() => {
    if (!selectedCell) return null;
    const [r, c] = selectedCell;
    return (
      clues.find((cl) => cl.direction === selectedDir && cl.cells.some(([cr, cc]) => cr === r && cc === c)) ??
      clues.find((cl) => cl.cells.some(([cr, cc]) => cr === r && cc === c)) ??
      null
    );
  })();
  const activeCellSet = new Set<string>(activeClue?.cells.map(([r, c]) => `${r},${c}`) ?? []);

  // ── Persist ──
  const saveProgress = useCallback(
    async (gridToSave: string[][]) => {
      if (!playerId || completedRef.current) return;
      try {
        const res = await apiFetch("/api/crossword/game", {
          method: "POST",
          body: JSON.stringify({ playerId, currentGrid: gridToSave, timeSeconds: timeRef.current }),
        });
        const data = await res.json();
        if (data.completed) {
          setCompleted(true);
          setSolution(data.solution);
          if (data.clues) setClues(data.clues);
          if (typeof data.timeSeconds === "number") setTimeSeconds(data.timeSeconds);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch {
        /* silent — progress is best-effort */
      }
    },
    [playerId]
  );
  const debouncedSave = useCallback(
    (gridToSave: string[][]) => {
      if (saveRef.current) clearTimeout(saveRef.current);
      saveRef.current = setTimeout(() => saveProgress(gridToSave), 800);
    },
    [saveProgress]
  );

  // ── Cell / clue selection ──
  function selectCell(r: number, c: number) {
    if (grid[r]?.[c] === ".") return;
    startTimer();
    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      setSelectedDir((d) => (d === "across" ? "down" : "across"));
    } else {
      // Prefer a direction that actually has a clue through this cell.
      const hasAcross = clues.some((cl) => cl.direction === "across" && cl.cells.some(([cr, cc]) => cr === r && cc === c));
      const hasDown = clues.some((cl) => cl.direction === "down" && cl.cells.some(([cr, cc]) => cr === r && cc === c));
      if (selectedDir === "across" && !hasAcross && hasDown) setSelectedDir("down");
      else if (selectedDir === "down" && !hasDown && hasAcross) setSelectedDir("across");
      setSelectedCell([r, c]);
    }
  }

  function selectClue(cl: Clue) {
    startTimer();
    setSelectedDir(cl.direction);
    const firstEmpty = cl.cells.find(([r, c]) => !currentGrid[r]?.[c]);
    setSelectedCell(firstEmpty ?? cl.cells[0]);
  }

  function stepClue(delta: number) {
    if (clues.length === 0) return;
    const idx = activeClue ? clues.findIndex((c) => c === activeClue) : -1;
    const next = clues[((idx + delta) % clues.length + clues.length) % clues.length];
    selectClue(next);
  }

  // ── Input ──
  const handleLetter = useCallback(
    (letter: string) => {
      if (!selectedCell || completed) return;
      startTimer();
      const [r, c] = selectedCell;
      if (grid[r]?.[c] === ".") return;

      const newGrid = currentGrid.map((row) => [...row]);
      newGrid[r][c] = letter.toUpperCase();
      setCurrentGrid(newGrid);

      // Auto-advance to next empty cell in the active word.
      if (activeClue) {
        const idx = activeClue.cells.findIndex(([cr, cc]) => cr === r && cc === c);
        for (let i = idx + 1; i < activeClue.cells.length; i++) {
          const [nr, nc] = activeClue.cells[i];
          if (!newGrid[nr][nc]) { setSelectedCell([nr, nc]); break; }
        }
      }

      const allFilled = newGrid.every((row, ri) => row.every((cell, ci) => grid[ri][ci] === "." || cell !== ""));
      if (allFilled) saveProgress(newGrid);
      else debouncedSave(newGrid);
    },
    [selectedCell, completed, grid, currentGrid, activeClue, startTimer, saveProgress, debouncedSave]
  );

  const handleBackspace = useCallback(() => {
    if (!selectedCell || completed) return;
    const [r, c] = selectedCell;
    if (grid[r]?.[c] === ".") return;
    if (currentGrid[r][c]) {
      const newGrid = currentGrid.map((row) => [...row]);
      newGrid[r][c] = "";
      setCurrentGrid(newGrid);
      debouncedSave(newGrid);
    } else if (activeClue) {
      const idx = activeClue.cells.findIndex(([cr, cc]) => cr === r && cc === c);
      if (idx > 0) {
        const [pr, pc] = activeClue.cells[idx - 1];
        setSelectedCell([pr, pc]);
        const newGrid = currentGrid.map((row) => [...row]);
        newGrid[pr][pc] = "";
        setCurrentGrid(newGrid);
        debouncedSave(newGrid);
      }
    }
  }, [selectedCell, completed, grid, currentGrid, activeClue, debouncedSave]);

  const handleKey = useCallback(
    (key: string) => {
      if (key === "⌫" || key === "Backspace") handleBackspace();
      else if (/^[a-z]$/.test(key)) handleLetter(key);
    },
    [handleBackspace, handleLetter]
  );

  // Hardware keyboard (browser dev + external keyboards).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (tab !== "game" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); handleLetter(e.key.toLowerCase()); }
      else if (e.key === "Backspace") { e.preventDefault(); handleBackspace(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleLetter, handleBackspace, tab]);

  function share() {
    const text = `🔤 RMV Mini Crossword\n⏱️ ${formatTime(timeSeconds)}\n\nPlay today's puzzle in the RMV app.`;
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (nav.share) nav.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => showToast("Copied!")).catch(() => {});
  }

  const acrossClues = clues.filter((c) => c.direction === "across");
  const downClues = clues.filter((c) => c.direction === "down");
  const cols = grid[0]?.length ?? 5;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[16px] pt-[env(safe-area-inset-top,0px)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center justify-between py-4">
        <Link to="/games" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={22} />
        </Link>
        <h1 className="text-[18px] font-bold" style={{ color: "var(--text)" }}>Crossword</h1>
        <div className="h-9 w-9" />
      </header>

      <div className="mb-3 flex justify-center">
        <div className="flex w-full rounded-[14px] p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <TabButton active={tab === "game"} onClick={() => setTab("game")} icon="grid_on">Game</TabButton>
          <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} icon="emoji_events">Leaderboard</TabButton>
        </div>
      </div>

      {tab === "leaderboard" ? (
        <CrosswordLeaderboard currentPlayerId={playerId} />
      ) : loading ? (
        <div className="py-16 text-center text-[14px]" style={{ color: "var(--text-3)" }}>Loading today's puzzle…</div>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Scrollable: timer + grid + clue lists */}
          <div className="flex flex-1 flex-col items-center overflow-y-auto">
            {/* Timer + result */}
            <div className="mb-3 flex items-center gap-2">
              <Icon name="schedule" size={17} style={{ color: completed ? "var(--success)" : "var(--text-3)" }} />
              <span className="one-mono text-[15px] font-bold" style={{ color: completed ? "var(--success)" : "var(--text-2)" }}>{formatTime(timeSeconds)}</span>
              {completed && (
                <>
                  <span className="text-[14px] font-bold" style={{ color: "var(--success)" }}>· Solved!</span>
                  <button onClick={share} className="ml-1 flex items-center gap-1 rounded-[9px] px-2.5 py-1 text-[12px] font-bold text-white active:opacity-90" style={{ background: "var(--accent-strong)" }}>
                    <Icon name="ios_share" size={14} style={{ color: "#fff" }} />Share
                  </button>
                </>
              )}
            </div>

            {/* Toast */}
            <div className="flex h-5 items-center justify-center">
              {toast && <span className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{toast}</span>}
            </div>

            {/* Grid */}
            <div
              className="grid w-full max-w-[300px] overflow-hidden rounded-[8px]"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, border: "2px solid var(--strong)", background: "var(--surface)" }}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  const isBlack = cell === ".";
                  const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                  const inWord = activeCellSet.has(`${r},${c}`);
                  const num = cellNumbers[r]?.[c] ?? 0;
                  const letter = completed && solution ? solution[r][c] : currentGrid[r]?.[c] ?? "";

                  let background = "var(--surface)";
                  if (isBlack) background = "var(--strong)";
                  else if (completed) background = "var(--success-soft)";
                  else if (isSelected) background = "var(--accent-soft)";
                  else if (inWord) background = "rgba(124,127,242,0.12)";

                  const borderRight = c === cols - 1 ? "none" : "1px solid var(--line)";
                  const borderBottom = r === grid.length - 1 ? "none" : "1px solid var(--line)";

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => !isBlack && selectCell(r, c)}
                      className="relative flex aspect-square select-none items-center justify-center text-[18px] font-bold uppercase"
                      style={{
                        background,
                        color: completed ? "var(--success)" : "var(--text)",
                        borderRight,
                        borderBottom,
                        cursor: isBlack ? "default" : "pointer",
                      }}
                    >
                      {!isBlack && num > 0 && (
                        <span className="absolute left-[2px] top-[1px] text-[8px] font-bold leading-none" style={{ color: "var(--text-3)" }}>{num}</span>
                      )}
                      {!isBlack && letter}
                    </div>
                  );
                })
              )}
            </div>

            {/* Clue lists */}
            <div className="mt-4 grid w-full grid-cols-2 gap-3 pb-2">
              <ClueColumn title="Across" clues={acrossClues} activeClue={activeClue} completed={completed} onPick={selectClue} />
              <ClueColumn title="Down" clues={downClues} activeClue={activeClue} completed={completed} onPick={selectClue} />
            </div>
          </div>

          {/* Pinned: active-clue bar + keyboard */}
          {!completed && (
            <div className="pt-1.5">
              {activeClue && (
                <div className="mb-2 flex items-center gap-1.5 rounded-[12px] px-2 py-2" style={{ background: "var(--accent-soft)" }}>
                  <button onClick={() => stepClue(-1)} className="flex h-7 w-7 flex-shrink-0 items-center justify-center active:opacity-70" aria-label="Previous clue">
                    <Icon name="chevron_left" size={22} style={{ color: "var(--accent)" }} />
                  </button>
                  <button onClick={() => setSelectedDir((d) => (d === "across" ? "down" : "across"))} className="min-w-0 flex-1 text-left">
                    <span className="text-[13.5px] font-semibold leading-snug" style={{ color: "var(--accent)" }}>
                      <span className="font-extrabold">{activeClue.number}{activeClue.direction === "across" ? "A" : "D"}.</span> {activeClue.clue}
                    </span>
                  </button>
                  <button onClick={() => stepClue(1)} className="flex h-7 w-7 flex-shrink-0 items-center justify-center active:opacity-70" aria-label="Next clue">
                    <Icon name="chevron_right" size={22} style={{ color: "var(--accent)" }} />
                  </button>
                </div>
              )}
              <Keyboard onKey={handleKey} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClueColumn({
  title, clues, activeClue, completed, onPick,
}: {
  title: string;
  clues: Clue[];
  activeClue: Clue | null;
  completed: boolean;
  onPick: (c: Clue) => void;
}) {
  return (
    <div>
      <h3 className="mb-1.5 one-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{title}</h3>
      <div className="flex flex-col gap-1">
        {clues.map((cl) => {
          const active = activeClue === cl;
          return (
            <button
              key={`${cl.number}-${cl.direction}`}
              onClick={() => onPick(cl)}
              className="rounded-[8px] px-2 py-1.5 text-left text-[12px] leading-snug active:opacity-80"
              style={active
                ? { background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 }
                : { background: "transparent", color: "var(--text-2)" }}
            >
              <span className="font-bold">{cl.number}.</span> {cl.clue}
              {completed && cl.answer && <span className="one-mono ml-1" style={{ color: "var(--text-3)" }}>({cl.answer})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Keyboard({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={i} className="flex w-full justify-center gap-[5px]">
          {row.map((key) => {
            const isWide = key === "⌫";
            return (
              <button
                key={key}
                onClick={() => onKey(key)}
                className="flex h-12 items-center justify-center rounded-[8px] text-[15px] font-bold uppercase select-none transition-transform active:scale-95"
                style={{ flex: isWide ? 1.6 : 1, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-strong)" }}
              >
                {key === "⌫" ? <Icon name="backspace" size={20} /> : key.toUpperCase()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: string; children: React.ReactNode }) {
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
