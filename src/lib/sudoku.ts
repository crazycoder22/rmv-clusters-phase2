/** Get today's date string in IST (YYYY-MM-DD) */
export function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

export type Difficulty = "easy" | "medium" | "hard";

/** How many cells to blank out per difficulty */
const CELLS_REMOVED: Record<Difficulty, number> = {
  easy: 35,
  medium: 45,
  hard: 52,
};

// ── Seeded PRNG ────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Board generation ───────────────────────────────────────────────────────

function isValid(board: number[], idx: number, num: number): boolean {
  const row = Math.floor(idx / 9);
  const col = idx % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 9; i++) {
    if (board[row * 9 + i] === num) return false;
    if (board[i * 9 + col] === num) return false;
    if (board[(boxRow + Math.floor(i / 3)) * 9 + (boxCol + (i % 3))] === num) return false;
  }
  return true;
}

function solve(board: number[], rng?: () => number): boolean {
  const empty = board.indexOf(0);
  if (empty === -1) return true;
  const digits = rng ? shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const d of digits) {
    if (isValid(board, empty, d)) {
      board[empty] = d;
      if (solve(board, rng)) return true;
      board[empty] = 0;
    }
  }
  return false;
}

function generateSolution(rng: () => number): number[] {
  const board = Array(81).fill(0);
  // Fill the 3 diagonal 3×3 boxes first (independent of each other)
  for (let box = 0; box < 3; box++) {
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    for (let i = 0; i < 9; i++) {
      const row = box * 3 + Math.floor(i / 3);
      const col = box * 3 + (i % 3);
      board[row * 9 + col] = digits[i];
    }
  }
  solve(board, rng);
  return board;
}

export interface SudokuPuzzle {
  puzzle: number[];   // 81 numbers, 0 = blank
  solution: number[]; // 81 numbers, fully filled
}

/**
 * Count solutions for a puzzle (stops at 2 to keep it fast).
 * Returns 0, 1, or 2.
 */
function countSolutions(board: number[], limit = 2): number {
  const empty = board.indexOf(0);
  if (empty === -1) return 1;
  let count = 0;
  for (let d = 1; d <= 9; d++) {
    if (isValid(board, empty, d)) {
      board[empty] = d;
      count += countSolutions(board, limit - count);
      board[empty] = 0;
      if (count >= limit) return count;
    }
  }
  return count;
}

export function generateDailyPuzzle(date: string, difficulty: Difficulty): SudokuPuzzle {
  const seed = hashString(`${date}-${difficulty}`);
  const rng = mulberry32(seed);

  const solution = generateSolution(rng);
  const puzzle = [...solution];

  // Remove cells in seeded-random order, but only if the puzzle
  // still has a unique solution after removal. This guarantees
  // every valid fill matches the stored solution.
  const indices = shuffle(Array.from({ length: 81 }, (_, i) => i), rng);
  const target = CELLS_REMOVED[difficulty];
  let removed = 0;

  for (const idx of indices) {
    if (removed >= target) break;

    const saved = puzzle[idx];
    puzzle[idx] = 0;

    // Check uniqueness — if more than one solution, put it back
    if (countSolutions([...puzzle]) !== 1) {
      puzzle[idx] = saved;
    } else {
      removed++;
    }
  }

  return { puzzle, solution };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Get all cell indices in the same row, column, and 3×3 box as `idx` */
export function getPeerIndices(idx: number): Set<number> {
  const row = Math.floor(idx / 9);
  const col = idx % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  const peers = new Set<number>();
  for (let i = 0; i < 9; i++) {
    peers.add(row * 9 + i);
    peers.add(i * 9 + col);
    peers.add((boxRow + Math.floor(i / 3)) * 9 + (boxCol + (i % 3)));
  }
  peers.delete(idx);
  return peers;
}

/** Returns set of cell indices that violate Sudoku rules (duplicates in row/col/box) */
export function getErrorCells(grid: number[], puzzle: number[]): Set<number> {
  const errors = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0) continue;
    const row = Math.floor(i / 9);
    const col = i % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    for (let j = 0; j < 9; j++) {
      // Row duplicate
      const ri = row * 9 + j;
      if (ri !== i && grid[ri] === grid[i]) { errors.add(i); errors.add(ri); }
      // Column duplicate
      const ci = j * 9 + col;
      if (ci !== i && grid[ci] === grid[i]) { errors.add(i); errors.add(ci); }
      // Box duplicate
      const bi = (boxRow + Math.floor(j / 3)) * 9 + (boxCol + (j % 3));
      if (bi !== i && grid[bi] === grid[i]) { errors.add(i); errors.add(bi); }
    }
  }
  // Only highlight user-entered cells (not locked puzzle cells)
  const userErrors = new Set<number>();
  for (const idx of errors) {
    if (puzzle[idx] === 0) userErrors.add(idx);
  }
  return userErrors;
}

/** Check if a filled grid is a valid complete Sudoku (all cells filled, no rule violations) */
export function isValidSudoku(grid: number[]): boolean {
  // All cells must be filled
  if (grid.some((v) => v === 0)) return false;

  // Check rows
  for (let r = 0; r < 9; r++) {
    const seen = new Set<number>();
    for (let c = 0; c < 9; c++) {
      const v = grid[r * 9 + c];
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  // Check columns
  for (let c = 0; c < 9; c++) {
    const seen = new Set<number>();
    for (let r = 0; r < 9; r++) {
      const v = grid[r * 9 + c];
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  // Check 3×3 boxes
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = new Set<number>();
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          const v = grid[r * 9 + c];
          if (seen.has(v)) return false;
          seen.add(v);
        }
      }
    }
  }
  return true;
}

/** Returns true when every cell is correctly filled (legacy — prefers isValidSudoku) */
export function isGridComplete(grid: number[], solution: number[]): boolean {
  return grid.every((v, i) => v !== 0 && v === solution[i]);
}

/** Format seconds as MM:SS */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Weekly Challenge Utilities ────────────────────────────────────────────

/** Get the Monday and Sunday bounding the week containing `date` (IST) */
export function getWeekBounds(date?: string): { monday: string; sunday: string } {
  const dateStr = date ?? getTodayIST();
  const d = new Date(dateStr + "T00:00:00+05:30");
  // JS getDay(): 0=Sun, 1=Mon ... 6=Sat
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    monday: monday.toISOString().split("T")[0],
    sunday: sunday.toISOString().split("T")[0],
  };
}

/** Points awarded by daily rank position */
const RANK_POINTS = [10, 8, 6, 5, 4, 3, 2];

interface GameForScoring {
  playerId: string;
  date: string;
  timeSeconds: number;
  player: { name: string; block: number; flatNumber: string };
}

export interface WeeklyLeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  totalPoints: number;
  totalTime: number;
  daysPlayed: number;
}

/** Calculate weekly leaderboard from an array of completed games in a week */
export function calculateWeeklyPoints(games: GameForScoring[]): WeeklyLeaderboardEntry[] {
  // Group games by date
  const byDate = new Map<string, GameForScoring[]>();
  for (const g of games) {
    const list = byDate.get(g.date) ?? [];
    list.push(g);
    byDate.set(g.date, list);
  }

  // For each date, rank by time and assign points
  const playerStats = new Map<string, {
    name: string;
    block: number;
    flatNumber: string;
    totalPoints: number;
    totalTime: number;
    daysPlayed: Set<string>;
  }>();

  for (const [date, dayGames] of byDate) {
    // Sort by fastest time
    dayGames.sort((a, b) => a.timeSeconds - b.timeSeconds);

    for (let i = 0; i < dayGames.length; i++) {
      const g = dayGames[i];
      const points = i < RANK_POINTS.length ? RANK_POINTS[i] : 1;

      let stats = playerStats.get(g.playerId);
      if (!stats) {
        stats = {
          name: g.player.name,
          block: g.player.block,
          flatNumber: g.player.flatNumber,
          totalPoints: 0,
          totalTime: 0,
          daysPlayed: new Set(),
        };
        playerStats.set(g.playerId, stats);
      }
      stats.totalPoints += points;
      stats.totalTime += g.timeSeconds;
      stats.daysPlayed.add(date);
    }
  }

  // Sort: most points first, then lowest total time as tiebreaker
  const entries = Array.from(playerStats.entries())
    .map(([playerId, stats]) => ({
      rank: 0,
      playerId,
      name: stats.name,
      block: stats.block,
      flatNumber: stats.flatNumber,
      totalPoints: stats.totalPoints,
      totalTime: stats.totalTime,
      daysPlayed: stats.daysPlayed.size,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.totalTime - b.totalTime);

  // Assign ranks
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}
