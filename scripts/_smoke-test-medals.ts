// Quick smoke test for the medals data layer — no HTTP, just hits the
// Prisma client directly. Picks two real residents (admin + recipient),
// awards a medal, queries the tally, deletes the award, confirms cleanup.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  const admin = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No SUPERADMIN found");

  const recipient = await prisma.resident.findFirst({
    where: { id: { not: admin.id } },
    select: { id: true, name: true },
  });
  if (!recipient) throw new Error("Need at least 2 residents");

  console.log(`Admin: ${admin.name}`);
  console.log(`Recipient: ${recipient.name}\n`);

  // Award a Gold medal
  const award = await prisma.$transaction(async (tx) => {
    const a = await tx.medalAward.create({
      data: {
        recipientId: recipient.id,
        game: "Wordle",
        tier: "GOLD",
        coins: 100,
        reason: "Smoke test award",
        awardedById: admin.id,
      },
    });
    await tx.notification.create({
      data: {
        residentId: recipient.id,
        medalAwardId: a.id,
        message: `🏆 You won a Gold medal in Wordle! +100 coins`,
      },
    });
    return a;
  });
  console.log(`✓ Created award ${award.id}`);

  // Compute tally
  const all = await prisma.medalAward.findMany({
    where: { recipientId: recipient.id },
    select: { tier: true, coins: true },
  });
  const tally = {
    gold: all.filter((a) => a.tier === "GOLD").length,
    silver: all.filter((a) => a.tier === "SILVER").length,
    bronze: all.filter((a) => a.tier === "BRONZE").length,
    coins: all.reduce((s, a) => s + a.coins, 0),
  };
  console.log(`✓ Recipient tally:`, tally);

  // Verify notification exists with the medalAwardId set
  const notif = await prisma.notification.findFirst({
    where: { medalAwardId: award.id },
  });
  if (!notif) throw new Error("Notification not created!");
  console.log(`✓ Notification created (id=${notif.id})`);

  // Delete the award; the notification should survive with medalAwardId=null
  await prisma.medalAward.delete({ where: { id: award.id } });
  const notifAfter = await prisma.notification.findUnique({
    where: { id: notif.id },
  });
  if (!notifAfter) throw new Error("Notification was deleted (cascade misfired)");
  if (notifAfter.medalAwardId !== null) {
    throw new Error(`Expected medalAwardId=null after award delete, got ${notifAfter.medalAwardId}`);
  }
  console.log(`✓ After award delete: notification kept, medalAwardId=null`);

  // Clean up the test notification
  await prisma.notification.delete({ where: { id: notif.id } });
  console.log(`\nAll medal smoke checks passed.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
