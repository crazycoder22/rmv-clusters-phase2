// Smoke test for the 2048 engine. Not a real test suite — just a sanity
// check that the slide/merge/game-over logic is correct before shipping.
// Run: npx tsx scripts/_test-2048.ts
import {
  move,
  isGameOver,
  getHighestTile,
  isScorePlausible,
} from "../src/lib/game2048";

function assertEq<T>(a: T, b: T, label: string) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) {
    console.error(`FAIL ${label}: expected ${sb}, got ${sa}`);
    process.exit(1);
  }
  console.log(`ok   ${label}`);
}

// 1. Basic merge left.
let b = [
  [0, 2, 0, 2],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];
let r = move(b, "left");
assertEq(r.board[0], [4, 0, 0, 0], "merge 2+2 left -> 4");
assertEq(r.gained, 4, "gain 4 from merge");
assertEq(r.moved, true, "moved=true");

// 2. Only one merge per pair.
b = [
  [2, 2, 2, 2],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];
r = move(b, "left");
assertEq(r.board[0], [4, 4, 0, 0], "2 2 2 2 left -> 4 4 0 0");
assertEq(r.gained, 8, "gain 8 from two merges");

// 3. Right on the same row.
r = move(b, "right");
assertEq(r.board[0], [0, 0, 4, 4], "2 2 2 2 right -> 0 0 4 4");

// 4. No-op detection.
b = [
  [2, 4, 8, 16],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];
r = move(b, "left");
assertEq(r.moved, false, "already-left row: moved=false");

// 5. Vertical move.
b = [
  [2, 0, 0, 0],
  [2, 0, 0, 0],
  [4, 0, 0, 0],
  [4, 0, 0, 0],
];
r = move(b, "up");
assertEq(
  r.board.map((row) => row[0]),
  [4, 8, 0, 0],
  "vertical merge up"
);

// 6. Down move: 2,2,4,4 stacked -> 0,0,4,8
b = [
  [2, 0, 0, 0],
  [2, 0, 0, 0],
  [4, 0, 0, 0],
  [4, 0, 0, 0],
];
r = move(b, "down");
assertEq(
  r.board.map((row) => row[0]),
  [0, 0, 4, 8],
  "vertical merge down"
);

// 7. Game over: no empty cells and no matching neighbours.
const deadBoard = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 2],
];
assertEq(isGameOver(deadBoard), true, "checkerboard = game over");

// 8. Alive: adjacent matching pair exists.
const aliveBoard = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 4],
];
assertEq(isGameOver(aliveBoard), false, "adjacent 4s = still alive");

// 9. Alive: board has an empty cell.
const aliveBoard2 = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 0],
];
assertEq(isGameOver(aliveBoard2), false, "empty cell = still alive");

// 10. Highest tile.
assertEq(
  getHighestTile([
    [0, 0, 0, 0],
    [0, 128, 0, 0],
    [0, 0, 64, 0],
    [0, 0, 0, 4],
  ]),
  128,
  "highest tile = 128"
);

// 11. Score plausibility — only rejects blatant cheats.
assertEq(isScorePlausible(20, 16), true, "plausible: 16-tile, score 20");
assertEq(isScorePlausible(10, 16), true, "low score OK (4-spawns cut the cascade)");
assertEq(isScorePlausible(9999999, 16), false, "too high for highest 16");
assertEq(isScorePlausible(0, 0), false, "zero tile invalid");
assertEq(isScorePlausible(50, 6), false, "non-power-of-two invalid");
assertEq(isScorePlausible(-5, 16), false, "negative score invalid");
assertEq(isScorePlausible(20480, 2048), true, "plausible: reached 2048");
assertEq(isScorePlausible(999999, 2048), false, "cheat: impossibly high for 2048");

console.log("\nAll 2048 engine checks passed.");
