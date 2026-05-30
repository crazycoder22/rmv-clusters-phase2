// One-off: award medals + coins to the top 3 of last night's
// Bollywood Quiz Night (session A447VL). Mirrors POST /api/medals so
// each award also creates an in-app notification for the recipient.
//
// Run: npx tsx scripts/_award-quiz-night-medals.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const SESSION_CODE = "A447VL";
const GAME_LABEL = "Quiz"; // matches the dropdown option in /admin/medals
const REASON = "Top 3 — Bollywood Dialogue Quiz Night, 19 Apr 2026";

// The top 3 we observed, in order. Hardcoded so the script is auditable
// and idempotent (re-running won't accidentally award based on a
// different order if scores tied later).
const TOP_3 = [
  { rank: 1, tier: "GOLD" as const,   coins: 100, expectedName: "Ashwini Baliga" },
  { rank: 2, tier: "SILVER" as const, coins: 50,  expectedName: "Divya Agarwal" },
  { rank: 3, tier: "BRONZE" as const, coins: 25,  expectedName: "Chintan Vaghela" },
];

async function main() {
  // 1. Fetch the session's top 3 by score.
  const session = await prisma.quizSession.findUnique({
    where: { code: SESSION_CODE },
    include: {
      players: {
        orderBy: { score: "desc" },
        take: 3,
        include: {
          player: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!session) {
    console.error(`Session ${SESSION_CODE} not found.`);
    process.exit(1);
  }
  if (session.players.length < 3) {
    console.error(`Only ${session.players.length} players — need at least 3.`);
    process.exit(1);
  }

  // 2. The awarder = first SUPERADMIN (matches the medals API).
  const awarder = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });
  if (!awarder) {
    console.error("No SUPERADMIN found to use as awarder.");
    process.exit(1);
  }
  console.log(`Awarder: ${awarder.name}\n`);

  // 3. For each top-3 spot: find the matching Resident by email,
  //    sanity-check name, then create the MedalAward + Notification
  //    in a single transaction (same as POST /api/medals).
  for (const slot of TOP_3) {
    const qp = session.players[slot.rank - 1];
    const sanity =
      qp.player.name.toLowerCase().includes(slot.expectedName.toLowerCase().split(" ")[0]);
    if (!sanity) {
      console.error(
        `Rank ${slot.rank} sanity check failed: expected "${slot.expectedName}", got "${qp.player.name}". Aborting.`
      );
      process.exit(1);
    }

    // The quiz uses WordlePlayer; medals hang off Resident. They share
    // an email (both are populated from Google auth on registration).
    const recipient = await prisma.resident.findUnique({
      where: { email: qp.player.email },
      select: { id: true, name: true, block: true, flatNumber: true },
    });
    if (!recipient) {
      console.error(
        `No Resident with email ${qp.player.email} (player ${qp.player.name}). Skipping.`
      );
      continue;
    }

    // Don't double-award if the script is re-run.
    const already = await prisma.medalAward.findFirst({
      where: {
        recipientId: recipient.id,
        game: GAME_LABEL,
        reason: REASON,
        tier: slot.tier,
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
          reason: REASON,
          awardedById: awarder.id,
        },
      });
      await tx.notification.create({
        data: {
          residentId: recipient.id,
          medalAwardId: award.id,
          message: `🏆 You won a ${tierLabel} medal in Quiz! +${slot.coins} coins`,
        },
      });
    });

    console.log(
      `  ✓ ${slot.tier.padEnd(6)} ${recipient.name.padEnd(22)} (B${recipient.block} ${recipient.flatNumber}) — +${slot.coins} coins`
    );
  }

  console.log(`\nDone. Recipients will see the medal in their navbar chip and bell.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
