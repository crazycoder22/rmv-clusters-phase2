// Check both the current and previous weekly windows to be sure we
// pick the right "last weekly challenge".
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import { getWeekBounds } from "../src/lib/sudoku";

async function main() {
  // Today is Apr 20, 2026 (Monday) — anchor several dates and see what
  // window getWeekBounds returns. Helps confirm whether 12-18 is "last"
  // or whether it has a one-day timezone glitch.
  const anchors = [
    "2026-04-20", // today
    "2026-04-19", // yesterday (Sun)
    "2026-04-15", // Wed of previous week
    "2026-04-13", // Mon of previous week (intended "last" Monday)
    "2026-04-21", // tomorrow (Tue)
  ];

  console.log("Anchor → Mon-Sun bounds returned by getWeekBounds:\n");
  for (const a of anchors) {
    const { monday, sunday } = getWeekBounds(a);
    console.log(`  ${a}  →  ${monday} … ${sunday}`);
  }

  console.log();

  // Also count completions per IST date for the past 14 days so we can
  // see when activity actually happened.
  const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const games = await prisma.sudokuGame.findMany({
    where: { completed: true, date: { gte: fourteenAgo } },
    select: { date: true, difficulty: true },
  });
  const perDate = new Map<string, { e: number; m: number; h: number }>();
  for (const g of games) {
    const r = perDate.get(g.date) ?? { e: 0, m: 0, h: 0 };
    if (g.difficulty === "easy") r.e += 1;
    else if (g.difficulty === "medium") r.m += 1;
    else if (g.difficulty === "hard") r.h += 1;
    perDate.set(g.date, r);
  }
  console.log("Sudoku completions per IST date (last 14 days):\n");
  console.log("  Date         Easy  Medium  Hard");
  Array.from(perDate.keys()).sort().forEach((d) => {
    const r = perDate.get(d)!;
    console.log(`  ${d}    ${String(r.e).padStart(3)}     ${String(r.m).padStart(3)}   ${String(r.h).padStart(3)}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
