// 2048 engine. Mirrors `../../../src/lib/game2048.ts` on the web.
// Pure functions — state ownership lives in the React component.

export type Board = number[][];
export type Direction = "up" | "down" | "left" | "right";

export const SIZE = 4;
export const WIN_TILE = 2048;

export function createEmptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function emptyCells(board: Board): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) out.push([r, c]);
    }
  }
  return out;
}

export function spawnTile(board: Board): boolean {
  const empties = emptyCells(board);
  if (empties.length === 0) return false;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

export function createBoard(): Board {
  const b = createEmptyBoard();
  spawnTile(b);
  spawnTile(b);
  return b;
}

function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const compact = row.filter((v) => v !== 0);
  const merged: number[] = [];
  let gained = 0;
  let i = 0;
  while (i < compact.length) {
    if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
      const sum = compact[i] * 2;
      merged.push(sum);
      gained += sum;
      i += 2;
    } else {
      merged.push(compact[i]);
      i += 1;
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { row: merged, gained };
}

function reverseRows(board: Board): Board {
  return board.map((row) => [...row].reverse());
}

function transpose(board: Board): Board {
  const out = createEmptyBoard();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      out[c][r] = board[r][c];
    }
  }
  return out;
}

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export function move(
  board: Board,
  dir: Direction
): { board: Board; gained: number; moved: boolean } {
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

  return { board: result, gained, moved: !boardsEqual(board, result) };
}

export function getHighestTile(board: Board): number {
  let max = 0;
  for (const row of board) for (const v of row) if (v > max) max = v;
  return max;
}

export function isGameOver(board: Board): boolean {
  for (const row of board) for (const v of row) if (v === 0) return false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r][c];
      if (c + 1 < SIZE && board[r][c + 1] === v) return false;
      if (r + 1 < SIZE && board[r + 1][c] === v) return false;
    }
  }
  return true;
}
