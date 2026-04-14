// ── 2048 game engine ───────────────────────────────────────────────────────
//
// Pure functions — no side effects beyond accepting an RNG. All board ops
// return new boards so React state updates stay predictable.

export type Board = number[][]; // 4x4 — 0 means empty
export type Direction = "up" | "down" | "left" | "right";

export const SIZE = 4;
export const WIN_TILE = 2048;

// ── Board creation & tile spawning ─────────────────────────────────────────

export function createEmptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/** Returns coordinates of all empty cells. */
function emptyCells(board: Board): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) out.push([r, c]);
    }
  }
  return out;
}

/**
 * Mutates `board` by adding a new 2 (90%) or 4 (10%) into a random empty cell.
 * Returns true if a tile was spawned, false if the board was already full.
 */
export function spawnTile(
  board: Board,
  rng: () => number = Math.random
): boolean {
  const empties = emptyCells(board);
  if (empties.length === 0) return false;
  const [r, c] = empties[Math.floor(rng() * empties.length)];
  board[r][c] = rng() < 0.9 ? 2 : 4;
  return true;
}

/** Start a fresh game: empty board with 2 tiles already placed. */
export function createBoard(rng: () => number = Math.random): Board {
  const b = createEmptyBoard();
  spawnTile(b, rng);
  spawnTile(b, rng);
  return b;
}

// ── Movement ───────────────────────────────────────────────────────────────

/**
 * Slide a single row LEFT and merge matching neighbours.
 * Each tile can participate in at most one merge per move (the classic rule).
 * Returns the new row plus the score gained from merges on this row.
 */
function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  // 1. Remove zeros — compact the non-zero tiles to the left.
  const compact = row.filter((v) => v !== 0);
  // 2. Walk left→right, merging matching neighbours.
  const merged: number[] = [];
  let gained = 0;
  let i = 0;
  while (i < compact.length) {
    if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
      const sum = compact[i] * 2;
      merged.push(sum);
      gained += sum;
      i += 2; // skip the consumed pair
    } else {
      merged.push(compact[i]);
      i += 1;
    }
  }
  // 3. Pad with zeros to restore row length.
  while (merged.length < SIZE) merged.push(0);
  return { row: merged, gained };
}

function reverseRows(board: Board): Board {
  return board.map((row) => [...row].reverse());
}

function transpose(board: Board): Board {
  const out: Board = createEmptyBoard();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      out[c][r] = board[r][c];
    }
  }
  return out;
}

/**
 * Apply a move. Returns the resulting board, score gained, and whether
 * anything actually changed (a move that doesn't change the board is a no-op
 * and should NOT spawn a new tile).
 */
export function move(
  board: Board,
  dir: Direction
): { board: Board; gained: number; moved: boolean } {
  // Transform board so the move becomes "left", slide, then undo transform.
  let working: Board;
  switch (dir) {
    case "left":
      working = cloneBoard(board);
      break;
    case "right":
      working = reverseRows(board);
      break;
    case "up":
      working = transpose(board);
      break;
    case "down":
      working = reverseRows(transpose(board));
      break;
  }

  let gained = 0;
  const slid: Board = working.map((row) => {
    const { row: newRow, gained: g } = slideRowLeft(row);
    gained += g;
    return newRow;
  });

  // Undo the transform.
  let result: Board;
  switch (dir) {
    case "left":
      result = slid;
      break;
    case "right":
      result = reverseRows(slid);
      break;
    case "up":
      result = transpose(slid);
      break;
    case "down":
      result = transpose(reverseRows(slid));
      break;
  }

  const moved = !boardsEqual(board, result);
  return { board: result, gained, moved };
}

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

// ── Game state queries ─────────────────────────────────────────────────────

export function getHighestTile(board: Board): number {
  let max = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] > max) max = board[r][c];
    }
  }
  return max;
}

/** True if no legal moves remain in any of the four directions. */
export function isGameOver(board: Board): boolean {
  // Any empty cell → not over.
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return false;
    }
  }
  // Any adjacent equal pair → merge is still possible.
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r][c];
      if (c + 1 < SIZE && board[r][c + 1] === v) return false;
      if (r + 1 < SIZE && board[r + 1][c] === v) return false;
    }
  }
  return true;
}

/**
 * Sanity-check a client-reported score against a highest tile. Used server-side
 * to reject obviously-fake submissions without replaying moves.
 *
 * Tight analytical bounds are fragile because the real minimum depends on how
 * many 4-tiles spawned vs 2-tiles (each 4-spawn saves merges & score). So we
 * only reject clear impossibilities:
 *   - negative score / invalid tile
 *   - highest tile not a power of two
 *   - score way above what's reachable even with a rich merge cascade
 *
 * The upper bound `12 * n * V + 10000` is very generous; we'd rather let an
 * unusually great run through than reject a legitimate player.
 */
export function isScorePlausible(score: number, highestTile: number): boolean {
  if (score < 0 || highestTile < 2) return false;
  if ((highestTile & (highestTile - 1)) !== 0) return false; // must be power of 2
  const n = Math.log2(highestTile);
  const maxScore = 12 * n * highestTile + 10000;
  return score <= maxScore;
}
