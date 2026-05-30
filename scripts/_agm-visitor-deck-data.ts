// AGM deck data: visitor-approval improvement story + per-block indicators.
// Produces console tables + writes CSVs to /tmp for pasting into slides.
//
// Run: npx tsx scripts/_agm-visitor-deck-data.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import fs from "fs";

const CAMPAIGN_START = "2026-04-10"; // first WhatsApp nudge
const ADOPTION_DAY = "2026-04-21";   // "no approval = no entry" enforced

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

async function main() {
  // Pull every flat-attributable visit (exclude common-area / masked rows).
  const rows = await prisma.visitLog.groupBy({
    by: ["visitDate", "block", "approvedByResident"],
    _count: { _all: true },
    where: { block: { not: null } },
  });

  // ── 1. Daily overall trend ────────────────────────────────────────────
  const daily = new Map<string, { total: number; approved: number }>();
  // ── Per-block-per-date ────────────────────────────────────────────────
  const blockDate = new Map<string, { total: number; approved: number }>();

  for (const r of rows) {
    const d = daily.get(r.visitDate) ?? { total: 0, approved: 0 };
    d.total += r._count._all;
    if (r.approvedByResident) d.approved += r._count._all;
    daily.set(r.visitDate, d);

    const bk = `${r.visitDate}|${r.block}`;
    const b = blockDate.get(bk) ?? { total: 0, approved: 0 };
    b.total += r._count._all;
    if (r.approvedByResident) b.approved += r._count._all;
    blockDate.set(bk, b);
  }

  const dates = Array.from(daily.keys()).sort();

  // ── Weekly rollup (Mon–Sun-ish, just 7-day chunks from first date) ─────
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(" 1. WEEKLY APPROVAL TREND (headline slide)");
  console.log("══════════════════════════════════════════════════════════");
  const weekly: { label: string; total: number; approved: number }[] = [];
  let wTotal = 0,
    wApproved = 0,
    wStart = dates[0];
  let dayCount = 0;
  for (const d of dates) {
    const v = daily.get(d)!;
    wTotal += v.total;
    wApproved += v.approved;
    dayCount++;
    if (dayCount === 7) {
      weekly.push({ label: `${wStart} → ${d}`, total: wTotal, approved: wApproved });
      wTotal = 0;
      wApproved = 0;
      dayCount = 0;
      const idx = dates.indexOf(d);
      wStart = dates[idx + 1] ?? d;
    }
  }
  if (dayCount > 0)
    weekly.push({ label: `${wStart} → ${dates[dates.length - 1]}`, total: wTotal, approved: wApproved });

  console.log("Week                       Visits  ResidentApproved   %");
  console.log("─────────────────────────  ──────  ────────────────  ────");
  for (const w of weekly) {
    console.log(
      `${w.label}   ${String(w.total).padStart(6)}  ${String(w.approved).padStart(16)}  ${String(pct(w.approved, w.total)).padStart(4)}%`
    );
  }

  // ── 2. Before vs After campaign ───────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(" 2. BEFORE vs AFTER (impact slide)");
  console.log("══════════════════════════════════════════════════════════");
  const phases = [
    { name: "Before campaign (up to 9 Apr)", lo: "0000-00-00", hi: "2026-04-09" },
    { name: "Campaign ramp (10–20 Apr)", lo: "2026-04-10", hi: "2026-04-20" },
    { name: "Post-Adoption Day (21 Apr →)", lo: "2026-04-21", hi: "9999-99-99" },
  ];
  for (const p of phases) {
    let t = 0,
      a = 0;
    for (const d of dates) {
      if (d >= p.lo && d <= p.hi) {
        t += daily.get(d)!.total;
        a += daily.get(d)!.approved;
      }
    }
    console.log(`${p.name.padEnd(34)}  ${String(a).padStart(5)}/${String(t).padStart(5)}  =  ${pct(a, t)}%`);
  }

  // ── 3. Per-block: last 7 days vs first 7 days ─────────────────────────
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(" 3. PER-BLOCK SCOREBOARD (block comparison slide)");
  console.log("══════════════════════════════════════════════════════════");
  const last7 = dates.slice(-7);
  const first7 = dates.slice(0, 7);
  console.log("Block   First-7-days %   Last-7-days %   Change");
  console.log("─────   ──────────────   ─────────────   ──────");
  for (const blk of [1, 2, 3, 4]) {
    const agg = (ds: string[]) => {
      let t = 0,
        a = 0;
      for (const d of ds) {
        const e = blockDate.get(`${d}|${blk}`);
        if (e) {
          t += e.total;
          a += e.approved;
        }
      }
      return { t, a };
    };
    const f = agg(first7);
    const l = agg(last7);
    const fp = pct(f.a, f.t);
    const lp = pct(l.a, l.t);
    const delta = Math.round((lp - fp) * 10) / 10;
    console.log(
      `  ${blk}     ${String(fp).padStart(11)}%   ${String(lp).padStart(10)}%   ${delta >= 0 ? "+" : ""}${delta} pts`
    );
  }

  // ── 4. Per-block engagement buckets (current state) ───────────────────
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(" 4. FLAT ENGAGEMENT BY BLOCK (last 30 days)");
  console.log("══════════════════════════════════════════════════════════");
  const cutoff = dates[Math.max(0, dates.length - 30)];
  const perFlat = await prisma.visitLog.groupBy({
    by: ["block", "flatNumber", "approvedByResident"],
    _count: { _all: true },
    where: { block: { not: null }, flatNumber: { not: null }, visitDate: { gte: cutoff } },
  });
  // flatKey -> {total, approved}
  const flatAgg = new Map<string, { block: number; total: number; approved: number }>();
  for (const r of perFlat) {
    const k = `${r.block}|${r.flatNumber}`;
    const e = flatAgg.get(k) ?? { block: r.block!, total: 0, approved: 0 };
    e.total += r._count._all;
    if (r.approvedByResident) e.approved += r._count._all;
    flatAgg.set(k, e);
  }
  const buckets: Record<number, { always: number; some: number; never: number }> = {
    1: { always: 0, some: 0, never: 0 },
    2: { always: 0, some: 0, never: 0 },
    3: { always: 0, some: 0, never: 0 },
    4: { always: 0, some: 0, never: 0 },
  };
  for (const e of flatAgg.values()) {
    const b = buckets[e.block];
    if (!b) continue;
    if (e.approved === 0) b.never++;
    else if (e.approved === e.total) b.always++;
    else b.some++;
  }
  console.log("Block   Always   Sometimes   Never   (flats with visits, 30d)");
  console.log("─────   ──────   ─────────   ─────");
  for (const blk of [1, 2, 3, 4]) {
    const b = buckets[blk];
    console.log(
      `  ${blk}    ${String(b.always).padStart(5)}    ${String(b.some).padStart(7)}    ${String(b.never).padStart(5)}`
    );
  }

  // ── 5. CSVs for charting in the deck ──────────────────────────────────
  const dailyCsv =
    "Date,TotalVisits,ResidentApproved,ApprovalPct\n" +
    dates
      .map((d) => {
        const v = daily.get(d)!;
        return `${d},${v.total},${v.approved},${pct(v.approved, v.total)}`;
      })
      .join("\n");
  fs.writeFileSync("/tmp/agm-daily-trend.csv", dailyCsv);

  const blockCsv =
    "Date,Block,TotalVisits,ResidentApproved,ApprovalPct\n" +
    dates
      .flatMap((d) =>
        [1, 2, 3, 4].map((blk) => {
          const e = blockDate.get(`${d}|${blk}`);
          if (!e) return null;
          return `${d},${blk},${e.total},${e.approved},${pct(e.approved, e.total)}`;
        })
      )
      .filter(Boolean)
      .join("\n");
  fs.writeFileSync("/tmp/agm-block-trend.csv", blockCsv);

  console.log("\n══════════════════════════════════════════════════════════");
  console.log(" CSV exports for charts:");
  console.log("   /tmp/agm-daily-trend.csv   (overall line chart)");
  console.log("   /tmp/agm-block-trend.csv   (per-block lines)");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`\nData window: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} days)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
