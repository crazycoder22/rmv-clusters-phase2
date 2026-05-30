// Show last week's (Mon-Sun) sudoku winners in each difficulty so we
// can decide how many medals to award.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import { calculateWeeklyPoints, getWeekBounds, formatTime } from "../src/lib/sudoku";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

// Today is Mon 20 Apr 2026, so "last week" = Mon 13 Apr → Sun 19 Apr.
// Pick any date in the target week and getWeekBounds will snap to its Mon-Sun.
const TARGET_DATE_IN_WEEK = "2026-04-15"; // Wed of last week

async function main() {
  const { monday, sunday } = getWeekBounds(TARGET_DATE_IN_WEEK);
  console.log(`\nWeek: ${monday} → ${sunday}\n`);

  for (const difficulty of DIFFICULTIES) {
    const games = await prisma.sudokuGame.findMany({
      where: {
        completed: true,
        timeSeconds: { not: null },
        difficulty,
        date: { gte: monday, lte: sunday },
      },
      select: {
        playerId: true,
        timeSeconds: true,
        date: true,
        player: { select: { name: true, block: true, flatNumber: true } },
      },
    });

    const lb = calculateWeeklyPoints(
      games.map((g) => ({
        playerId: g.playerId,
        date: g.date,
        timeSeconds: g.timeSeconds!,
        player: g.player,
      }))
    );

    console.log(`── ${difficulty.toUpperCase()} ──  (${games.length} games, ${lb.length} unique players)`);
    if (lb.length === 0) {
      console.log("  (no completions this week)\n");
      continue;
    }
    console.log("  Rank  Pts  Days  TotalTime  Name                  Block/Flat");
    console.log("  ────  ───  ────  ─────────  ────────────────────  ──────────");
    lb.slice(0, 5).forEach((e) => {
      const rank = String(e.rank).padStart(2, " ");
      const pts = String(e.totalPoints).padStart(3, " ");
      const days = String(e.daysPlayed).padStart(2, " ");
      const tt = formatTime(e.totalTime).padStart(8, " ");
      const name = (e.name || "—").padEnd(20, " ").slice(0, 20);
      const where = `B${e.block} ${e.flatNumber}`;
      console.log(`    ${rank}  ${pts}  ${days}     ${tt}  ${name}  ${where}`);
    });
    console.log();
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
