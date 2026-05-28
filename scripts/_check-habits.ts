import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { computeStreaks, istYmd, istTodayYmd } from "../src/lib/habits";

// Read-only inspector for the Habit tracker. Mirrors _check-device-tokens.ts.
// Usage: npx tsx scripts/_check-habits.ts
async function main() {
  const today = istTodayYmd();

  const habits = await prisma.habit.findMany({
    include: {
      owner: { select: { name: true, block: true, flatNumber: true } },
      partner: { select: { name: true } },
      checkins: { select: { date: true } },
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  console.log(`\n=== Habits: ${habits.length} (today = ${today} IST) ===\n`);

  if (habits.length === 0) {
    console.log("(no habits yet)");
    await prisma.$disconnect();
    return;
  }

  for (const h of habits) {
    const startYmd = istYmd(h.startDate);
    const endYmd = istYmd(h.endDate);
    const stats = computeStreaks(
      h.checkins.map((c) => c.date),
      startYmd,
      endYmd,
      today
    );
    const todayDone = h.checkins.some((c) => istYmd(c.date) === today);

    console.log(
      [
        `${h.emoji ?? "  "} ${h.title}`,
        `   owner:    ${h.owner.name} (B${h.owner.block} ${h.owner.flatNumber})`,
        `   range:    ${startYmd} → ${endYmd}${h.active ? "" : "  [inactive]"}`,
        `   partner:  ${
          h.partner ? `${h.partner.name} [${h.partnerStatus}]` : "—"
        }`,
        `   today:    ${todayDone ? "✅ done" : "⬜ not yet"}`,
        `   streaks:  current ${stats.currentStreak} · best ${stats.longestStreak} · ${stats.totalDone} days · ${stats.completionPct}%`,
        `   nudged:   ${h.lastNudgedAt ? h.lastNudgedAt.toISOString() : "never"}`,
      ].join("\n")
    );
    console.log("");
  }

  // Quick aggregate.
  const withPartner = habits.filter((h) => h.partnerStatus === "accepted").length;
  const pending = habits.filter((h) => h.partnerStatus === "pending").length;
  console.log(
    `Summary: ${habits.length} habits · ${withPartner} with accepted partner · ${pending} pending invites`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
