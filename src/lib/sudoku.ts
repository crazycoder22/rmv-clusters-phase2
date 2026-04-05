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

export function generateDailyPuzzle(date: string, difficulty: Difficulty): SudokuPuzzle {
  const seed = hashString(`${date}-${difficulty}`);
  const rng = mulberry32(seed);

  const solution = generateSolution(rng);
  const puzzle = [...solution];

  // Remove cells in seeded-random order
  const indices = shuffle(Array.from({ length: 81 }, (_, i) => i), rng);
  const toRemove = CELLS_REMOVED[difficulty];
  for (let i = 0; i < toRemove; i++) {
    puzzle[indices[i]] = 0;
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

/** Returns set of cell indices where the player's value differs from solution */
export function getErrorCells(grid: number[], puzzle: number[], solution: number[]): Set<number> {
  const errors = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] === 0 && grid[i] !== 0 && grid[i] !== solution[i]) {
      errors.add(i);
    }
  }
  return errors;
}

/** Returns true when every cell is correctly filled */
export function isGridComplete(grid: number[], solution: number[]): boolean {
  return grid.every((v, i) => v !== 0 && v === solution[i]);
}

/** Format seconds as MM:SS */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
