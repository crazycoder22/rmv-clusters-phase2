"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Clock, Delete } from "lucide-react";
import { formatTime } from "@/lib/crossword";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

interface CrosswordClue {
  number: number;
  direction: "across" | "down";
  clue: string;
  answer?: string;
  cells: [number, number][];
}

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  timeSeconds: number;
}

// ── Registration form ──────────────────────────────────────────────────────

function RegistrationForm({ onRegister }: { onRegister: (id: string, name: string) => void }) {
  const [name, setName] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/wordle/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, block: Number(block), flatNumber, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      localStorage.setItem("crossword_player_id", data.playerId);
      localStorage.setItem("crossword_player_name", data.name);
      onRegister(data.playerId, data.name);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Mini Crossword</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter your details to start playing</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={block} onChange={(e) => setBlock(e.target.value)} placeholder="Block" required min={1} className={inputClass} />
            <input value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} placeholder="Flat Number" required className={inputClass} />
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className={inputClass} />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required className={inputClass} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 text-sm transition-colors">
            {saving ? "Registering..." : "Start Playing"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function CrosswordPage() {
  // Player state
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  // Game state
  const [grid, setGrid] = useState<string[][]>([]);
  const [currentGrid, setCurrentGrid] = useState<string[][]>([]);
  const [cellNumbers, setCellNumbers] = useState<number[][]>([]);
  const [clues, setClues] = useState<CrosswordClue[]>([]);
  const [completed, setCompleted] = useState(false);
  const [solution, setSolution] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [selectedDir, setSelectedDir] = useState<"across" | "down">("across");

  // Timer
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tabs
  const [tab, setTab] = useState<"game" | "leaderboard">("game");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // Save debounce
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto-register from localStorage ──────────────────────────────────
  useEffect(() => {
    const id = localStorage.getItem("crossword_player_id");
    const name = localStorage.getItem("crossword_player_name");
    if (id && name) {
      setPlayerId(id);
      setPlayerName(name);
      setRegistered(true);
    } else {
      // Try from wordle/sudoku
      const wId = localStorage.getItem("wordle_player_id") || localStorage.getItem("sudoku_player_id");
      const wName = localStorage.getItem("wordle_player_name") || localStorage.getItem("sudoku_player_name");
      if (wId && wName) {
        localStorage.setItem("crossword_player_id", wId);
        localStorage.setItem("crossword_player_name", wName);
        setPlayerId(wId);
        setPlayerName(wName);
        setRegistered(true);
      } else {
        setLoading(false);
      }
    }
  }, []);

  // ── Fetch game ───────────────────────────────────────────────────────
  const fetchGame = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crossword/game?playerId=${pid}`);
      const data = await res.json();
      if (!res.ok) return;

      setGrid(data.grid);
      setCurrentGrid(data.currentGrid);
      setCellNumbers(data.cellNumbers);
      setClues(data.clues);
      setCompleted(data.completed);
      setSolution(data.solution);
      if (data.timeSeconds) setTimeSeconds(data.timeSeconds);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (playerId) fetchGame(playerId);
  }, [playerId, fetchGame]);

  // ── Timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerStarted && !completed) {
      timerRef.current = setInterval(() => setTimeSeconds((t) => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerStarted, completed]);

  // ── Active clue logic ────────────────────────────────────────────────
  const getActiveClue = useCallback((): CrosswordClue | null => {
    if (!selectedCell) return null;
    const [r, c] = selectedCell;
    return clues.find((cl) =>
      cl.direction === selectedDir && cl.cells.some(([cr, cc]) => cr === r && cc === c)
    ) || null;
  }, [selectedCell, selectedDir, clues]);

  const activeClue = getActiveClue();
  const activeCellSet = new Set<string>(activeClue?.cells.map(([r, c]) => `${r},${c}`) || []);

  // ── Save progress ────────────────────────────────────────────────────
  const saveProgress = useCallback(async (gridToSave: string[][]) => {
    if (!playerId || completed) return;
    try {
      const res = await fetch("/api/crossword/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, currentGrid: gridToSave, timeSeconds }),
      });
      const data = await res.json();
      if (data.completed) {
        setCompleted(true);
        setSolution(data.solution);
        if (data.clues) setClues(data.clues);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch { /* silent */ }
  }, [playerId, completed, timeSeconds]);

  const debouncedSave = useCallback((gridToSave: string[][]) => {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => saveProgress(gridToSave), 800);
  }, [saveProgress]);

  // ── Cell click handler ───────────────────────────────────────────────
  const handleCellClick = (r: number, c: number) => {
    if (grid[r][c] === ".") return; // black cell
    if (!timerStarted && !completed) setTimerStarted(true);

    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      // Toggle direction on same cell
      setSelectedDir((d) => (d === "across" ? "down" : "across"));
    } else {
      setSelectedCell([r, c]);
    }
  };

  // ── Clue click handler ──────────────────────────────────────────────
  const handleClueClick = (clue: CrosswordClue) => {
    setSelectedDir(clue.direction);
    // Select first empty cell in this clue, or first cell
    const firstEmpty = clue.cells.find(([r, c]) => !currentGrid[r][c]);
    setSelectedCell(firstEmpty || clue.cells[0]);
  };

  // ── Letter input ─────────────────────────────────────────────────────
  const handleLetter = useCallback((letter: string) => {
    if (!selectedCell || completed) return;
    if (!timerStarted) setTimerStarted(true);
    const [r, c] = selectedCell;
    if (grid[r][c] === ".") return;

    const newGrid = currentGrid.map((row) => [...row]);
    newGrid[r][c] = letter.toUpperCase();
    setCurrentGrid(newGrid);

    // Auto-advance to next empty cell in active clue
    if (activeClue) {
      const idx = activeClue.cells.findIndex(([cr, cc]) => cr === r && cc === c);
      for (let i = idx + 1; i < activeClue.cells.length; i++) {
        const [nr, nc] = activeClue.cells[i];
        if (!newGrid[nr][nc]) {
          setSelectedCell([nr, nc]);
          break;
        }
      }
    }

    // Check if potentially complete (all cells filled)
    const allFilled = newGrid.every((row, ri) =>
      row.every((cell, ci) => grid[ri][ci] === "." || cell !== "")
    );
    if (allFilled) {
      // Immediate save to check completion
      saveProgress(newGrid);
    } else {
      debouncedSave(newGrid);
    }
  }, [selectedCell, completed, timerStarted, grid, currentGrid, activeClue, saveProgress, debouncedSave]);

  const handleBackspace = useCallback(() => {
    if (!selectedCell || completed) return;
    const [r, c] = selectedCell;
    if (grid[r][c] === ".") return;

    if (currentGrid[r][c]) {
      const newGrid = currentGrid.map((row) => [...row]);
      newGrid[r][c] = "";
      setCurrentGrid(newGrid);
      debouncedSave(newGrid);
    } else if (activeClue) {
      // Move back to previous cell in clue
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

  // ── Keyboard handler ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleLetter(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Move to next clue
        const currentIdx = clues.findIndex((cl) => cl === activeClue);
        if (currentIdx >= 0) {
          const nextClue = clues[(currentIdx + 1) % clues.length];
          handleClueClick(nextClue);
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!selectedCell) return;
        const [r, c] = selectedCell;
        const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        const dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 5 && nc >= 0 && nc < 5 && grid[nr]?.[nc] === ".") {
          nr += dr; nc += dc;
        }
        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5 && grid[nr][nc] !== ".") {
          setSelectedCell([nr, nc]);
          if (dr !== 0) setSelectedDir("down");
          if (dc !== 0) setSelectedDir("across");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleLetter, handleBackspace, selectedCell, grid, clues, activeClue]);

  // ── Fetch leaderboard ────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "leaderboard") return;
    setLbLoading(true);
    fetch("/api/crossword/leaderboard")
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.leaderboard || []))
      .finally(() => setLbLoading(false));
  }, [tab]);

  // ── Render ───────────────────────────────────────────────────────────

  const acrossClues = clues.filter((c) => c.direction === "across");
  const downClues = clues.filter((c) => c.direction === "down");

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Link href="/" className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Mini Crossword</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button onClick={() => setTab("game")} className={clsx("px-3 py-1 text-xs font-medium rounded-md transition-colors", tab === "game" ? "bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-400 shadow-sm" : "text-gray-500 dark:text-gray-400")}>
            Game
          </button>
          <button onClick={() => setTab("leaderboard")} className={clsx("px-3 py-1 text-xs font-medium rounded-md transition-colors", tab === "leaderboard" ? "bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-400 shadow-sm" : "text-gray-500 dark:text-gray-400")}>
            <Trophy size={12} className="inline mr-1" />Board
          </button>
        </div>
      </div>

      {!registered ? (
        <RegistrationForm onRegister={(id, name) => { setPlayerId(id); setPlayerName(name); setRegistered(true); }} />
      ) : tab === "leaderboard" ? (
        /* ── Leaderboard ───────────────────────────────────────────── */
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Trophy size={18} className="text-yellow-500" /> Today&apos;s Leaderboard
          </h2>
          {lbLoading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No completions yet today</p>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((e) => (
                <div key={e.playerId} className={clsx("flex items-center justify-between p-2.5 rounded-lg border text-sm", e.playerId === playerId ? "border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10" : "border-gray-100 dark:border-gray-700")}>
                  <div className="flex items-center gap-2.5">
                    <span className={clsx("w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold", e.rank <= 3 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400")}>
                      {e.rank}
                    </span>
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{e.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-1.5">Block {e.block}, {e.flatNumber}</span>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400 flex items-center gap-1">
                    <Clock size={13} /> {formatTime(e.timeSeconds)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">Loading puzzle...</div>
      ) : (
        /* ── Game ──────────────────────────────────────────────────── */
        <>
          {/* Timer */}
          <div className="text-center mb-4">
            <span className={clsx("inline-flex items-center gap-1.5 font-mono text-lg font-semibold", completed ? "text-green-600 dark:text-green-400" : "text-gray-700 dark:text-gray-300")}>
              <Clock size={18} />
              {formatTime(timeSeconds)}
            </span>
            {completed && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-medium">Puzzle Complete!</p>
            )}
          </div>

          {/* 5×5 Grid */}
          <div className="flex justify-center mb-5">
            <div className="grid grid-cols-5 gap-0 border-2 border-gray-800 dark:border-gray-300" style={{ width: "min(280px, 80vw)", height: "min(280px, 80vw)" }}>
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  const isBlack = cell === ".";
                  const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                  const isInWord = activeCellSet.has(`${r},${c}`);
                  const num = cellNumbers[r]?.[c];
                  const letter = completed && solution ? solution[r][c] : currentGrid[r]?.[c] || "";
                  const isCorrect = completed && solution && letter === solution[r][c];

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => !isBlack && handleCellClick(r, c)}
                      className={clsx(
                        "relative flex items-center justify-center border border-gray-300 dark:border-gray-600 select-none",
                        isBlack
                          ? "bg-gray-800 dark:bg-gray-900"
                          : isSelected
                            ? "bg-primary-200 dark:bg-primary-700/50 cursor-pointer"
                            : isInWord
                              ? "bg-primary-50 dark:bg-primary-900/20 cursor-pointer"
                              : completed
                                ? "bg-green-50 dark:bg-green-900/10 cursor-default"
                                : "bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50",
                      )}
                      style={{ aspectRatio: "1" }}
                    >
                      {!isBlack && num > 0 && (
                        <span className="absolute top-0.5 left-1 text-[9px] font-semibold text-gray-500 dark:text-gray-400 leading-none">
                          {num}
                        </span>
                      )}
                      {!isBlack && (
                        <span className={clsx("text-base sm:text-lg font-bold uppercase", completed ? "text-gray-800 dark:text-gray-100" : letter ? "text-gray-800 dark:text-gray-100" : "text-transparent")}>
                          {letter || "."}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Clues */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Across</h3>
              <div className="space-y-1">
                {acrossClues.map((cl) => (
                  <button
                    key={`${cl.number}A`}
                    onClick={() => handleClueClick(cl)}
                    className={clsx(
                      "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                      activeClue === cl
                        ? "bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    )}
                  >
                    <span className="font-semibold mr-1">{cl.number}.</span>
                    {cl.clue}
                    {completed && cl.answer && (
                      <span className="ml-1 text-gray-400 dark:text-gray-500 font-mono">({cl.answer})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Down</h3>
              <div className="space-y-1">
                {downClues.map((cl) => (
                  <button
                    key={`${cl.number}D`}
                    onClick={() => handleClueClick(cl)}
                    className={clsx(
                      "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                      activeClue === cl
                        ? "bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    )}
                  >
                    <span className="font-semibold mr-1">{cl.number}.</span>
                    {cl.clue}
                    {completed && cl.answer && (
                      <span className="ml-1 text-gray-400 dark:text-gray-500 font-mono">({cl.answer})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* On-screen keyboard */}
          {!completed && (
            <div className="space-y-1.5 max-w-sm mx-auto">
              {[
                ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
                ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
                ["Z", "X", "C", "V", "B", "N", "M"],
              ].map((row, ri) => (
                <div key={ri} className={clsx("flex gap-1 justify-center", ri === 1 && "px-3", ri === 2 && "px-6")}>
                  {row.map((key) => (
                    <button
                      key={key}
                      onClick={() => handleLetter(key)}
                      className="flex-1 max-w-[36px] h-10 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 transition-colors"
                    >
                      {key}
                    </button>
                  ))}
                  {ri === 2 && (
                    <button
                      onClick={handleBackspace}
                      className="flex-1 max-w-[50px] h-10 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                    >
                      <Delete size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
