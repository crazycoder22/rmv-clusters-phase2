// Wipe all per-day / per-run game records so leaderboards start fresh.
// Designed to run on Monday morning IST after the weekly winners have been
// awarded — preserves today's records (anything dated >= today IST) so a
// game played already this morning doesn't get clobbered.
//
// Touches: WordleGame, SudokuGame, MemoryGame, CrosswordGame (date-keyed)
// + Game2048Run (timestamp-keyed). Does NOT touch MedalAward, Notifications,
// or any session-scoped games (Quiz / Tambola / Memory-Multi / Fantasy)
// because those are ephemeral and clean themselves up.
//
// Examples:
//   npx tsx scripts/_reset-game-leaderboards.ts            # preview counts
//   npx tsx scripts/_reset-game-leaderboards.ts --apply    # actually delete

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import { getTodayIST } from "../src/lib/memory";

async function main() {
  const apply = process.argv.includes("--apply");
  const today = getTodayIST(); // YYYY-MM-DD in IST
  // Start of today in IST, expressed in UTC, for timestamp-keyed tables.
  const todayStartUtc = new Date(`${today}T00:00:00.000+05:30`);

  console.log(`Mode:              ${apply ? "APPLY" : "PREVIEW"}`);
  console.log(`Today (IST):       ${today}`);
  console.log(`Cutoff (UTC):      ${todayStartUtc.toISOString()}\n`);

  const dateLT = { lt: today };
  const tsLT = { lt: todayStartUtc };

  const [wordle, sudoku, memory, crossword, g2048] = await Promise.all([
    prisma.wordleGame.count({ where: { date: dateLT } }),
    prisma.sudokuGame.count({ where: { date: dateLT } }),
    prisma.memoryGame.count({ where: { date: dateLT } }),
    prisma.crosswordGame.count({ where: { date: dateLT } }),
    prisma.game2048Run.count({ where: { createdAt: tsLT } }),
  ]);

  console.log("Records that will be deleted (date < today, IST):");
  console.log(`  WordleGame:     ${wordle}`);
  console.log(`  SudokuGame:     ${sudoku}`);
  console.log(`  MemoryGame:     ${memory}`);
  console.log(`  CrosswordGame:  ${crossword}`);
  console.log(`  Game2048Run:    ${g2048}`);
  const total = wordle + sudoku + memory + crossword + g2048;
  console.log(`  ────────────`);
  console.log(`  Total:          ${total}\n`);

  if (total === 0) {
    console.log("Nothing to delete.");
    await prisma.$disconnect();
    return;
  }

  if (!apply) {
    console.log("Dry run. Re-run with --apply to actually delete.");
    await prisma.$disconnect();
    return;
  }

  console.log("Deleting…");
  const [d1, d2, d3, d4, d5] = await prisma.$transaction([
    prisma.wordleGame.deleteMany({ where: { date: dateLT } }),
    prisma.sudokuGame.deleteMany({ where: { date: dateLT } }),
    prisma.memoryGame.deleteMany({ where: { date: dateLT } }),
    prisma.crosswordGame.deleteMany({ where: { date: dateLT } }),
    prisma.game2048Run.deleteMany({ where: { createdAt: tsLT } }),
  ]);

  console.log(`✓ WordleGame:     ${d1.count}`);
  console.log(`✓ SudokuGame:     ${d2.count}`);
  console.log(`✓ MemoryGame:     ${d3.count}`);
  console.log(`✓ CrosswordGame:  ${d4.count}`);
  console.log(`✓ Game2048Run:    ${d5.count}`);
  console.log(`✓ Total deleted:  ${d1.count + d2.count + d3.count + d4.count + d5.count}`);

  await prisma.$disconnect();
  console.log("\nDone — all leaderboards now reset to today's window.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
