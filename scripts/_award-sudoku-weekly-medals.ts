// Award medals + coins to the top 3 of last week's Sudoku weekly
// challenge in EACH difficulty (easy/medium/hard) → 9 medals total.
// Mirrors POST /api/medals so each award also creates an in-app
// notification for the recipient.
//
// "Last week" is the most recently completed Sun-Sat window per
// getWeekBounds (which is what the /sudoku weekly leaderboard shows).
// As of 2026-04-20, that's 2026-04-12 → 2026-04-18.
//
// Run: npx tsx scripts/_award-sudoku-weekly-medals.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import { calculateWeeklyPoints, getWeekBounds } from "../src/lib/sudoku";

const GAME_LABEL = "Sudoku";
// Pick any date inside the target week — getWeekBounds snaps to its Sun-Sat.
const TARGET_DATE_IN_WEEK = "2026-04-15";
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const TIERS = [
  { rank: 1, tier: "GOLD" as const,   coins: 100 },
  { rank: 2, tier: "SILVER" as const, coins: 50 },
  { rank: 3, tier: "BRONZE" as const, coins: 25 },
];

async function main() {
  const { monday, sunday } = getWeekBounds(TARGET_DATE_IN_WEEK);
  console.log(`\nWeek: ${monday} → ${sunday}\n`);

  // Awarder = first SUPERADMIN.
  const awarder = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });
  if (!awarder) {
    console.error("No SUPERADMIN found.");
    process.exit(1);
  }
  console.log(`Awarder: ${awarder.name}\n`);

  for (const difficulty of DIFFICULTIES) {
    console.log(`── ${difficulty.toUpperCase()} ──`);
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
        player: {
          select: { name: true, block: true, flatNumber: true, email: true },
        },
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

    if (lb.length < 3) {
      console.log(`  Only ${lb.length} player(s) — skipping (need at least 3).\n`);
      continue;
    }

    // The leaderboard entry only has playerId/name; we need email to map
    // WordlePlayer → Resident. Build a lookup from the raw games data.
    const emailByPlayerId = new Map<string, string>();
    for (const g of games) {
      emailByPlayerId.set(g.playerId, g.player.email);
    }

    for (const slot of TIERS) {
      const e = lb[slot.rank - 1];
      const email = emailByPlayerId.get(e.playerId);
      if (!email) {
        console.log(`  ⚠️  Rank ${slot.rank} ${e.name} — no email on file, skipping.`);
        continue;
      }
      const recipient = await prisma.resident.findUnique({
        where: { email },
        select: { id: true, name: true, block: true, flatNumber: true },
      });
      if (!recipient) {
        console.log(`  ⚠️  Rank ${slot.rank} ${e.name} (${email}) — no Resident record, skipping.`);
        continue;
      }

      const reason =
        `Sudoku Weekly Challenge (${difficulty}) — ${slot.rank === 1 ? "1st" : slot.rank === 2 ? "2nd" : "3rd"} place ` +
        `· ${e.totalPoints} pts over ${e.daysPlayed} days · week of ${monday}`;

      // Don't double-award if the script is re-run.
      const already = await prisma.medalAward.findFirst({
        where: {
          recipientId: recipient.id,
          game: GAME_LABEL,
          tier: slot.tier,
          reason,
        },
      });
      if (already) {
        console.log(
          `  ⏭  ${slot.tier.padEnd(6)} ${recipient.name} — already awarded (id ${already.id})`
        );
        continue;
      }

      const tierLabel =
        slot.tier === "GOLD" ? "Gold" : slot.tier === "SILVER" ? "Silver" : "Bronze";

      await prisma.$transaction(async (tx) => {
        const award = await tx.medalAward.create({
          data: {
            recipientId: recipient.id,
            game: GAME_LABEL,
            tier: slot.tier,
            coins: slot.coins,
            reason,
            awardedById: awarder.id,
          },
        });
        await tx.notification.create({
          data: {
            residentId: recipient.id,
            medalAwardId: award.id,
            message: `🏆 You won a ${tierLabel} medal in Sudoku (${difficulty})! +${slot.coins} coins`,
          },
        });
      });

      console.log(
        `  ✓ ${slot.tier.padEnd(6)} ${recipient.name.padEnd(22)} (B${recipient.block} ${recipient.flatNumber}) — ${e.totalPoints} pts · +${slot.coins} coins`
      );
    }
    console.log();
  }

  console.log(`Done. Recipients see medals in their navbar chip and bell.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
