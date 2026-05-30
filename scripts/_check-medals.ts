// Read-only sanity check: list every medal award + recipient totals.
// Useful after running an award script to verify everything landed.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  const awards = await prisma.medalAward.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      recipient: { select: { name: true, block: true, flatNumber: true } },
      awardedBy: { select: { name: true } },
      notifications: { select: { id: true, read: true, message: true } },
    },
  });

  if (awards.length === 0) {
    console.log("No awards yet.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Last ${awards.length} awards:\n`);
  for (const a of awards) {
    const tier =
      a.tier === "GOLD" ? "🥇 Gold" : a.tier === "SILVER" ? "🥈 Silver" : "🥉 Bronze";
    console.log(`${tier}  ${a.recipient.name} (B${a.recipient.block} ${a.recipient.flatNumber})`);
    console.log(`  game=${a.game}  coins=${a.coins}  reason="${a.reason ?? ""}"`);
    console.log(
      `  notifications=${a.notifications.length} (unread=${a.notifications.filter((n) => !n.read).length})`
    );
    console.log(`  awarded by ${a.awardedBy.name} on ${a.createdAt.toISOString()}\n`);
  }

  // Per-recipient totals for the recipients in this batch.
  const recipientIds = [...new Set(awards.map((a) => a.recipientId))];
  console.log(`\nTotals for ${recipientIds.length} recipient(s):\n`);
  for (const rid of recipientIds) {
    const all = await prisma.medalAward.findMany({
      where: { recipientId: rid },
      select: { tier: true, coins: true },
    });
    const r = await prisma.resident.findUnique({
      where: { id: rid },
      select: { name: true },
    });
    const g = all.filter((a) => a.tier === "GOLD").length;
    const s = all.filter((a) => a.tier === "SILVER").length;
    const b = all.filter((a) => a.tier === "BRONZE").length;
    const c = all.reduce((sum, a) => sum + a.coins, 0);
    console.log(
      `  ${r?.name?.padEnd(22) ?? "—"}  🥇${g}  🥈${s}  🥉${b}   💰 ${c} coins`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
