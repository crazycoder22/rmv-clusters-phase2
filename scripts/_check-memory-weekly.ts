// Verify the new Mon-Sun memory weekly leaderboard machinery.
// Prints the bounds + any completions found in the current week.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import { getCurrentWeekBounds, getTodayIST, ACTIVE_DIFFICULTY, calculateScore } from "../src/lib/memory";

async function main() {
  const today = getTodayIST();
  const { monday, sunday } = getCurrentWeekBounds();
  console.log(`Today (IST):      ${today}`);
  console.log(`Active difficulty: ${ACTIVE_DIFFICULTY}`);
  console.log(`Weekly window:    ${monday} → ${sunday}\n`);

  // Sanity-check on a few anchor dates that the helper handles edge cases.
  const samples = ["2026-04-19", "2026-04-20", "2026-04-21", "2026-04-26", "2026-04-27"];
  console.log("Helper output for sample dates:");
  for (const d of samples) {
    const w = getCurrentWeekBounds(d);
    console.log(`  anchor=${d}  →  ${w.monday} … ${w.sunday}`);
  }
  console.log();

  // Pull whatever hard-mode completions exist this week (probably none yet).
  const games = await prisma.memoryGame.findMany({
    where: {
      date: { gte: monday, lte: sunday },
      difficulty: ACTIVE_DIFFICULTY,
      completed: true,
    },
    include: {
      player: { select: { name: true, block: true, flatNumber: true } },
    },
  });

  console.log(`Hard-mode completions this week: ${games.length}\n`);
  if (games.length === 0) {
    console.log("(Leaderboard is empty — first completion will appear here.)");
  } else {
    // Aggregate per player.
    const map = new Map<string, { name: string; total: number; days: Set<string> }>();
    for (const g of games) {
      const score = calculateScore(g.moves, g.timeSeconds ?? 0, ACTIVE_DIFFICULTY);
      const r = map.get(g.playerId) ?? { name: g.player.name, total: 0, days: new Set<string>() };
      r.total += score;
      r.days.add(g.date);
      map.set(g.playerId, r);
    }
    console.log("Rank  Score  Days  Name");
    Array.from(map.values())
      .sort((a, b) => b.total - a.total || b.days.size - a.days.size)
      .forEach((r, i) => {
        console.log(
          `  ${String(i + 1).padStart(2)}  ${String(r.total).padStart(5)}  ${String(r.days.size).padStart(4)}   ${r.name}`
        );
      });
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
