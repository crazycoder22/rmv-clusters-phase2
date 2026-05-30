// One-off: count visitor approvals in the last 6 days.
// Run: npx tsx scripts/_visitor-approvals-6d.ts
import "dotenv/config";
// .env.local takes precedence in Next.js; replicate that here.
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  // Last 6 days in IST, inclusive of today.
  const DAYS = 6;
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const todayIST = istNow.toISOString().split("T")[0];
  const dates: string[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(istNow);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  dates.reverse();

  const since = new Date(istNow);
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);
  const sinceUtc = new Date(since.getTime() - istOffsetMs);

  console.log(`\nToday (IST): ${todayIST}`);
  console.log(`Window: ${dates[0]} → ${dates[dates.length - 1]} (${DAYS} days)\n`);

  // ── 1. In-app Visitor table (PENDING/APPROVED/REJECTED) ──────────────────
  const visitorTotal = await prisma.visitor.count({
    where: { createdAt: { gte: sinceUtc } },
  });
  const visitorApproved = await prisma.visitor.count({
    where: { createdAt: { gte: sinceUtc }, status: "APPROVED" },
  });
  const visitorPending = await prisma.visitor.count({
    where: { createdAt: { gte: sinceUtc }, status: "PENDING" },
  });
  const visitorRejected = await prisma.visitor.count({
    where: { createdAt: { gte: sinceUtc }, status: "REJECTED" },
  });

  console.log("━━ In-app Visitor requests (Visitor table) ━━");
  console.log(`  Total created:         ${visitorTotal}`);
  console.log(`    APPROVED:            ${visitorApproved}`);
  console.log(`    PENDING:             ${visitorPending}`);
  console.log(`    REJECTED:            ${visitorRejected}`);

  // ── 2. MyGate VisitLog (approvedByResident) ───────────────────────────────
  const visitLogs = await prisma.visitLog.findMany({
    where: { visitDate: { in: dates } },
    select: { visitDate: true, approvedByResident: true },
  });

  const logTotal = visitLogs.length;
  const logApproved = visitLogs.filter((v) => v.approvedByResident).length;
  const logGuardOnly = logTotal - logApproved;

  console.log("\n━━ MyGate visits (VisitLog table) ━━");
  console.log(`  Total visits:          ${logTotal}`);
  console.log(`    Approved by resident:${logApproved}`);
  console.log(`    Guard-only:          ${logGuardOnly}`);

  // Per-day breakdown for VisitLog (usually the more interesting one).
  const byDate = new Map<string, { total: number; approved: number }>();
  for (const d of dates) byDate.set(d, { total: 0, approved: 0 });
  for (const v of visitLogs) {
    const row = byDate.get(v.visitDate);
    if (!row) continue;
    row.total += 1;
    if (v.approvedByResident) row.approved += 1;
  }

  console.log("\n  Daily breakdown (visits / resident-approved):");
  for (const [d, row] of byDate) {
    const pct = row.total > 0 ? Math.round((row.approved / row.total) * 100) : 0;
    console.log(
      `    ${d}:  ${row.total.toString().padStart(4)} total  |  ${row.approved.toString().padStart(4)} approved  (${pct}%)`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
