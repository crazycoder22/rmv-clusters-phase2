// Client-only sudoku helpers used by the mobile UI. The puzzle and
// validation live on the server (see `../../../src/lib/sudoku.ts`); we just
// need peer/error highlighting and time formatting here.

export type Difficulty = "easy" | "medium" | "hard";

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

export function getErrorCells(grid: number[], puzzle: number[]): Set<number> {
  const errors = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0) continue;
    const row = Math.floor(i / 9);
    const col = i % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let j = 0; j < 9; j++) {
      const ri = row * 9 + j;
      if (ri !== i && grid[ri] === grid[i]) {
        errors.add(i);
        errors.add(ri);
      }
      const ci = j * 9 + col;
      if (ci !== i && grid[ci] === grid[i]) {
        errors.add(i);
        errors.add(ci);
      }
      const bi = (boxRow + Math.floor(j / 3)) * 9 + (boxCol + (j % 3));
      if (bi !== i && grid[bi] === grid[i]) {
        errors.add(i);
        errors.add(bi);
      }
    }
  }
  const userErrors = new Set<number>();
  for (const idx of errors) {
    if (puzzle[idx] === 0) userErrors.add(idx);
  }
  return userErrors;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
