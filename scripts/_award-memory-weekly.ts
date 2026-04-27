// Compute a Memory weekly leaderboard for a given Monday→Sunday window and
// either preview the standings (default) or award Gold/Silver/Bronze medals
// to the top 3 players (with --apply).
//
// Default window = last week ending Sunday. Override with --week=YYYY-MM-DD
// (any date inside the desired week).
//
// Examples:
//   npx tsx scripts/_award-memory-weekly.ts                # preview last week
//   npx tsx scripts/_award-memory-weekly.ts --apply        # award last week
//   npx tsx scripts/_award-memory-weekly.ts --week=2026-04-23 --apply

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import {
  getCurrentWeekBounds,
  getTodayIST,
  ACTIVE_DIFFICULTY,
  calculateScore,
} from "../src/lib/memory";

type Tier = "GOLD" | "SILVER" | "BRONZE";

const COINS: Record<Tier, number> = {
  GOLD: 100,
  SILVER: 50,
  BRONZE: 25,
};

const GAME_LABEL = "Memory Match (Weekly)";

function shiftDay(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().split("T")[0];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const weekArg = process.argv.find((a) => a.startsWith("--week="));
  // Default: last full week (anchor on yesterday relative to today, but
  // anchor on the previous-week's Sunday is cleaner).
  const today = getTodayIST();
  const lastWeekAnchor = weekArg ? weekArg.split("=")[1] : shiftDay(today, -7);
  const { monday, sunday } = getCurrentWeekBounds(lastWeekAnchor);

  console.log(`Mode:           ${apply ? "APPLY" : "PREVIEW"}`);
  console.log(`Today (IST):    ${today}`);
  console.log(`Window:         ${monday} → ${sunday}\n`);

  const games = await prisma.memoryGame.findMany({
    where: {
      date: { gte: monday, lte: sunday },
      difficulty: ACTIVE_DIFFICULTY,
      completed: true,
    },
    include: {
      player: {
        select: { name: true, block: true, flatNumber: true, email: true },
      },
    },
  });

  if (games.length === 0) {
    console.log("No completions in this window. Nothing to award.");
    await prisma.$disconnect();
    return;
  }

  // Aggregate per player.
  type Row = {
    playerId: string;
    name: string;
    email: string;
    block: number;
    flatNumber: string;
    total: number;
    daysPlayed: number;
  };
  const map = new Map<string, Row>();
  for (const g of games) {
    const score = calculateScore(g.moves, g.timeSeconds ?? 0, ACTIVE_DIFFICULTY);
    const r =
      map.get(g.playerId) ??
      ({
        playerId: g.playerId,
        name: g.player.name,
        email: g.player.email,
        block: g.player.block,
        flatNumber: g.player.flatNumber,
        total: 0,
        daysPlayed: 0,
      } satisfies Row);
    r.total += score;
    r.daysPlayed += 1;
    map.set(g.playerId, r);
  }

  const ranked = Array.from(map.values()).sort(
    (a, b) => b.total - a.total || b.daysPlayed - a.daysPlayed
  );

  console.log("Final standings:");
  console.log("Rank  Score  Days   Name (Block / Flat)");
  ranked.forEach((r, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}  ${String(r.total).padStart(5)}  ${String(r.daysPlayed).padStart(4)}   ${r.name}  (${r.block}/${r.flatNumber})`
    );
  });
  console.log();

  // Top 3 — match WordlePlayer.email back to a Resident.
  const top = ranked.slice(0, 3);
  const tiers: Tier[] = ["GOLD", "SILVER", "BRONZE"];

  const resolved: {
    tier: Tier;
    coins: number;
    row: Row;
    residentId: string | null;
  }[] = [];
  for (let i = 0; i < top.length; i++) {
    const row = top[i];
    const tier = tiers[i];
    const resident = await prisma.resident.findUnique({
      where: { email: row.email.toLowerCase() },
      select: { id: true },
    });
    resolved.push({
      tier,
      coins: COINS[tier],
      row,
      residentId: resident?.id ?? null,
    });
  }

  console.log("Awards to be granted:");
  for (const r of resolved) {
    const status = r.residentId ? "OK" : "NO MATCH";
    console.log(
      `  ${r.tier.padEnd(6)}  +${String(r.coins).padStart(3)} coins  ${r.row.name}  [${status}]`
    );
  }
  console.log();

  if (!apply) {
    console.log("Dry run. Re-run with --apply to actually award + notify.");
    await prisma.$disconnect();
    return;
  }

  // Pick an awarder — first SUPERADMIN.
  const awardedBy = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });
  if (!awardedBy) {
    console.error("No SUPERADMIN found to attribute the awards. Aborting.");
    process.exit(1);
  }
  console.log(`Awarder: ${awardedBy.name}\n`);

  // Skip if any player can't be matched to a Resident.
  const unmatched = resolved.filter((r) => !r.residentId);
  if (unmatched.length > 0) {
    console.error(
      `${unmatched.length} of the top players could not be matched to a Resident:`
    );
    for (const u of unmatched) console.error(`  - ${u.row.name} <${u.row.email}>`);
    console.error(
      "\nFix the email mapping (Resident.email == WordlePlayer.email) before re-running."
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  // Create medals + notifications.
  for (const r of resolved) {
    const reason = `Memory Match weekly winner · ${monday} – ${sunday} · ${r.row.total} pts across ${r.row.daysPlayed} day${r.row.daysPlayed === 1 ? "" : "s"}`;
    await prisma.$transaction(async (tx) => {
      const award = await tx.medalAward.create({
        data: {
          recipientId: r.residentId!,
          game: GAME_LABEL,
          tier: r.tier,
          coins: r.coins,
          reason,
          awardedById: awardedBy.id,
        },
      });
      const tierLabel =
        r.tier === "GOLD" ? "Gold" : r.tier === "SILVER" ? "Silver" : "Bronze";
      await tx.notification.create({
        data: {
          residentId: r.residentId!,
          medalAwardId: award.id,
          message: `🏆 You won a ${tierLabel} medal in ${GAME_LABEL}! +${r.coins} coins`,
        },
      });
    });
    console.log(`✓ ${r.tier} → ${r.row.name} (+${r.coins} coins)`);
  }

  // Create matching announcement so everyone sees the winners.
  const fmt = (s: string) =>
    new Date(s + "T00:00:00+05:30").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  const trophyEmoji = ["🥇", "🥈", "🥉"];
  const podium = resolved
    .map(
      (r, i) =>
        `${trophyEmoji[i]} ${r.row.name} (Block ${r.row.block}, ${r.row.flatNumber}) — ${r.row.total} pts`
    )
    .join("\n");

  const annTitle = `🏆 Memory Match — Weekly Winners (${fmt(monday)} – ${fmt(sunday)})`;
  const annSummary =
    `This week's Memory Match podium: ` +
    resolved.map((r) => r.row.name.split(" ")[0]).join(", ") +
    `. Coins added to their totals.`;
  const annBody = `Congratulations to this week's Memory Match champions!

${podium}

🥇 Gold +${COINS.GOLD} coins
🥈 Silver +${COINS.SILVER} coins
🥉 Bronze +${COINS.BRONZE} coins

A new week starts today — daily challenge resets every midnight IST. Play at /memory and climb the leaderboard.`;

  const announcement = await prisma.announcement.create({
    data: {
      title: annTitle,
      date: new Date(),
      category: "general",
      priority: "normal",
      summary: annSummary,
      body: annBody,
      author: awardedBy.name,
      emoji: "🏆",
      link: "/memory",
      linkText: "Play Memory Match",
      published: true,
    },
  });
  console.log(`\n✓ Created announcement ${announcement.id}`);

  // Notify all residents.
  const residents = await prisma.resident.findMany({ select: { id: true } });
  const fanout = await prisma.notification.createMany({
    data: residents.map((r) => ({
      residentId: r.id,
      announcementId: announcement.id,
    })),
    skipDuplicates: true,
  });
  console.log(`✓ Notified ${fanout.count} resident(s) via the announcement\n`);

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
