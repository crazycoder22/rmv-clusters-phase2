/**
 * Last-7-day visitor stats — summary for presentation slides.
 *
 * Produces:
 *   1. Overall daily trend (all blocks combined)
 *   2. Daily trend per block
 *   3. Totals per block (total + unapproved + rate)
 *   4. Per-block unapproved breakdown by fromSource (Swiggy, Amazon, Zomato, etc.)
 *   5. Top visitor types overall
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

const END_DATE = "2026-04-19"; // yesterday (inclusive)
const DAYS = 7;

const CSV_DIR = join(homedir(), "Downloads", `rmv-visitor-stats-${END_DATE}`);
mkdirSync(CSV_DIR, { recursive: true });

function writeCsv(name: string, rows: string[][]): void {
  const escape = (v: string): string => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = rows.map((r) => r.map(escape).join(",")).join("\n") + "\n";
  writeFileSync(join(CSV_DIR, name), text, "utf8");
}

function dateRange(end: string, days: number): string[] {
  const out: string[] = [];
  const [y, m, d] = end.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(base);
    dt.setUTCDate(base.getUTCDate() - i);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

function normalizeSource(s: string | null): string {
  if (!s) return "(blank)";
  const t = s.trim();
  if (!t) return "(blank)";
  const upper = t.toUpperCase();
  // Normalize common variants
  if (upper.includes("SWIGGY")) return "Swiggy";
  if (upper.includes("ZOMATO")) return "Zomato";
  if (upper.includes("ZEPTO")) return "Zepto";
  if (upper.includes("BLINKIT") || upper.includes("GROFERS")) return "Blinkit";
  if (upper.includes("INSTAMART")) return "Instamart";
  if (upper.includes("AMAZON")) return "Amazon";
  if (upper.includes("FLIPKART") || upper.includes("EKART")) return "Flipkart";
  if (upper.includes("DUNZO")) return "Dunzo";
  if (upper.includes("BIGBASKET") || upper.includes("BB DAILY")) return "BigBasket";
  if (upper.includes("MEESHO")) return "Meesho";
  if (upper.includes("MYNTRA")) return "Myntra";
  if (upper.includes("DELHIVERY")) return "Delhivery";
  if (upper.includes("BLUEDART") || upper.includes("BLUE DART")) return "BlueDart";
  if (upper.includes("DTDC")) return "DTDC";
  if (upper.includes("UBER") || upper.includes("OLA") || upper.includes("RAPIDO")) return "Cab/Auto";
  return t;
}

function pad(s: string | number, w: number, right = false): string {
  const str = String(s);
  if (str.length >= w) return str;
  return right ? str.padStart(w, " ") : str.padEnd(w, " ");
}

function printTable(rows: string[][]): void {
  if (rows.length === 0) return;
  const cols = rows[0].length;
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(...rows.map((r) => (r[i] ?? "").length)),
  );
  for (const row of rows) {
    console.log(row.map((c, i) => pad(c ?? "", widths[i], i > 0)).join("  "));
  }
}

async function main() {
  const days = dateRange(END_DATE, DAYS);
  const startDate = days[0];
  const endDate = days[days.length - 1];

  console.log(`\n━━━ Visitor Analytics: ${startDate} → ${endDate} (${DAYS} days) ━━━\n`);

  const all = await prisma.visitLog.findMany({
    where: { visitDate: { gte: startDate, lte: endDate } },
    select: {
      visitDate: true,
      block: true,
      fromSource: true,
      visitorType: true,
      approvedByResident: true,
      inTime: true,
    },
  });

  console.log(`Total visit records: ${all.length}\n`);

  // ─── 1. Daily trend (all blocks) ─────────────────────────────────────
  console.log("━━━ 1. Daily trend (all blocks) ━━━\n");
  const byDate = new Map<string, { total: number; unapproved: number }>();
  days.forEach((d) => byDate.set(d, { total: 0, unapproved: 0 }));
  for (const r of all) {
    const b = byDate.get(r.visitDate);
    if (!b) continue;
    b.total++;
    if (!r.approvedByResident) b.unapproved++;
  }
  const dayRows: string[][] = [["Date", "Total", "Unapproved", "Rate%"]];
  for (const d of days) {
    const b = byDate.get(d)!;
    const rate = b.total > 0 ? ((b.unapproved / b.total) * 100).toFixed(1) : "—";
    dayRows.push([d, String(b.total), String(b.unapproved), rate]);
  }
  printTable(dayRows);
  writeCsv("01_daily_trend_all_blocks.csv", dayRows);

  // ─── 2. Daily trend per block ────────────────────────────────────────
  console.log("\n━━━ 2a. Daily TOTAL visits per block ━━━\n");
  const blocks = [1, 2, 3, 4];
  const byBlockDateTotal = new Map<string, number>();
  const byBlockDateUnapp = new Map<string, number>();
  for (const r of all) {
    if (!r.block) continue;
    const key = `${r.block}|${r.visitDate}`;
    byBlockDateTotal.set(key, (byBlockDateTotal.get(key) ?? 0) + 1);
    if (!r.approvedByResident) {
      byBlockDateUnapp.set(key, (byBlockDateUnapp.get(key) ?? 0) + 1);
    }
  }
  const blockDayRows: string[][] = [["Date", "Blk 1", "Blk 2", "Blk 3", "Blk 4", "Total"]];
  for (const d of days) {
    const cells = [d];
    let total = 0;
    for (const b of blocks) {
      const v = byBlockDateTotal.get(`${b}|${d}`) ?? 0;
      total += v;
      cells.push(String(v));
    }
    cells.push(String(total));
    blockDayRows.push(cells);
  }
  printTable(blockDayRows);
  writeCsv("02a_daily_total_per_block.csv", blockDayRows);

  console.log("\n━━━ 2b. Daily UNAPPROVED visits per block ━━━\n");
  const blockUnappRows: string[][] = [["Date", "Blk 1", "Blk 2", "Blk 3", "Blk 4", "Total"]];
  for (const d of days) {
    const cells = [d];
    let total = 0;
    for (const b of blocks) {
      const v = byBlockDateUnapp.get(`${b}|${d}`) ?? 0;
      total += v;
      cells.push(String(v));
    }
    cells.push(String(total));
    blockUnappRows.push(cells);
  }
  printTable(blockUnappRows);
  writeCsv("02b_daily_unapproved_per_block.csv", blockUnappRows);

  console.log("\n━━━ 2c. Daily UNAPPROVED RATE % per block ━━━\n");
  const blockRateRows: string[][] = [["Date", "Blk 1", "Blk 2", "Blk 3", "Blk 4", "Overall"]];
  for (const d of days) {
    const cells = [d];
    let tot = 0, un = 0;
    for (const b of blocks) {
      const t = byBlockDateTotal.get(`${b}|${d}`) ?? 0;
      const u = byBlockDateUnapp.get(`${b}|${d}`) ?? 0;
      tot += t;
      un += u;
      cells.push(t > 0 ? ((u / t) * 100).toFixed(1) : "—");
    }
    cells.push(tot > 0 ? ((un / tot) * 100).toFixed(1) : "—");
    blockRateRows.push(cells);
  }
  printTable(blockRateRows);
  writeCsv("02c_daily_unapproved_rate_per_block.csv", blockRateRows);

  // ─── 3. Totals per block ─────────────────────────────────────────────
  console.log("\n━━━ 3. Totals per block (7-day) ━━━\n");
  const byBlock = new Map<number, { total: number; unapproved: number }>();
  for (const b of blocks) byBlock.set(b, { total: 0, unapproved: 0 });
  let commonArea = { total: 0, unapproved: 0 };
  for (const r of all) {
    const bucket = r.block ? byBlock.get(r.block)! : commonArea;
    bucket.total++;
    if (!r.approvedByResident) bucket.unapproved++;
  }
  const blockRows: string[][] = [["Block", "Total", "Unapproved", "Rate%"]];
  for (const b of blocks) {
    const v = byBlock.get(b)!;
    const rate = v.total > 0 ? ((v.unapproved / v.total) * 100).toFixed(1) : "—";
    blockRows.push([`Block ${b}`, String(v.total), String(v.unapproved), rate]);
  }
  const caRate = commonArea.total > 0 ? ((commonArea.unapproved / commonArea.total) * 100).toFixed(1) : "—";
  blockRows.push(["Common/Other", String(commonArea.total), String(commonArea.unapproved), caRate]);
  printTable(blockRows);
  writeCsv("03_block_totals.csv", blockRows);

  // ─── 4. Per-block unapproved breakdown by fromSource ─────────────────
  console.log("\n━━━ 4. Unapproved visits per block, by source/category ━━━\n");
  // Collect normalized sources present in any block, then build a wide matrix
  const allSources = new Set<string>();
  const perBlockSrcCount: Record<number, Map<string, number>> = {};
  for (const b of blocks) {
    perBlockSrcCount[b] = new Map();
    for (const r of all.filter((r) => r.block === b && !r.approvedByResident)) {
      const src = normalizeSource(r.fromSource);
      allSources.add(src);
      perBlockSrcCount[b].set(src, (perBlockSrcCount[b].get(src) ?? 0) + 1);
    }
  }
  for (const b of blocks) {
    const subset = all.filter((r) => r.block === b && !r.approvedByResident);
    if (subset.length === 0) {
      console.log(`Block ${b}: no unapproved visits`);
      continue;
    }
    const counts = perBlockSrcCount[b];
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    console.log(`\nBlock ${b} — ${subset.length} unapproved visits, top sources:`);
    const rows: string[][] = [["Source", "Count", "Share%"]];
    for (const [src, cnt] of sorted.slice(0, 12)) {
      rows.push([src, String(cnt), ((cnt / subset.length) * 100).toFixed(1)]);
    }
    if (sorted.length > 12) {
      const rest = sorted.slice(12).reduce((s, [, c]) => s + c, 0);
      rows.push([`(${sorted.length - 12} others)`, String(rest), ((rest / subset.length) * 100).toFixed(1)]);
    }
    printTable(rows);
    // Also write the full (untruncated) per-block CSV
    const fullRows: string[][] = [["Source", "Count", "Share%"]];
    for (const [src, cnt] of sorted) {
      fullRows.push([src, String(cnt), ((cnt / subset.length) * 100).toFixed(1)]);
    }
    writeCsv(`04_block${b}_unapproved_by_source.csv`, fullRows);
  }
  // Wide matrix: sources × blocks
  const sourcesSorted = Array.from(allSources).sort((a, b) => {
    const ta = blocks.reduce((s, bl) => s + (perBlockSrcCount[bl].get(a) ?? 0), 0);
    const tb = blocks.reduce((s, bl) => s + (perBlockSrcCount[bl].get(b) ?? 0), 0);
    return tb - ta;
  });
  const matrix: string[][] = [["Source", ...blocks.map((b) => `Blk ${b}`), "Total"]];
  for (const s of sourcesSorted) {
    const counts = blocks.map((b) => perBlockSrcCount[b].get(s) ?? 0);
    const total = counts.reduce((a, c) => a + c, 0);
    matrix.push([s, ...counts.map(String), String(total)]);
  }
  writeCsv("04_unapproved_source_block_matrix.csv", matrix);

  // ─── 5. Overall top sources (all blocks combined) ────────────────────
  console.log("\n━━━ 5. Top sources overall — unapproved only (all blocks) ━━━\n");
  const overallSrc = new Map<string, number>();
  const unapprovedAll = all.filter((r) => !r.approvedByResident);
  for (const r of unapprovedAll) {
    const src = normalizeSource(r.fromSource);
    overallSrc.set(src, (overallSrc.get(src) ?? 0) + 1);
  }
  const overallSorted = Array.from(overallSrc.entries()).sort((a, b) => b[1] - a[1]);
  const overallRows: string[][] = [["Source", "Count", "Share%"]];
  for (const [src, cnt] of overallSorted.slice(0, 15)) {
    overallRows.push([src, String(cnt), ((cnt / unapprovedAll.length) * 100).toFixed(1)]);
  }
  printTable(overallRows);
  // full (untruncated) overall source CSV
  const overallFullRows: string[][] = [["Source", "Count", "Share%"]];
  for (const [src, cnt] of overallSorted) {
    overallFullRows.push([src, String(cnt), ((cnt / unapprovedAll.length) * 100).toFixed(1)]);
  }
  writeCsv("05_overall_unapproved_by_source.csv", overallFullRows);

  // ─── 6. Top visitor types ────────────────────────────────────────────
  console.log("\n━━━ 6. Top visitor types (all blocks, 7-day) ━━━\n");
  const typeCounts = new Map<string, { total: number; unapproved: number }>();
  for (const r of all) {
    const key = r.visitorType || "(unknown)";
    const t = typeCounts.get(key) ?? { total: 0, unapproved: 0 };
    t.total++;
    if (!r.approvedByResident) t.unapproved++;
    typeCounts.set(key, t);
  }
  const typeSorted = Array.from(typeCounts.entries()).sort((a, b) => b[1].total - a[1].total);
  const typeRows: string[][] = [["Visitor Type", "Total", "Unapproved", "Rate%"]];
  for (const [k, v] of typeSorted.slice(0, 10)) {
    const rate = v.total > 0 ? ((v.unapproved / v.total) * 100).toFixed(1) : "—";
    typeRows.push([k, String(v.total), String(v.unapproved), rate]);
  }
  printTable(typeRows);
  const typeFullRows: string[][] = [["Visitor Type", "Total", "Unapproved", "Rate%"]];
  for (const [k, v] of typeSorted) {
    const rate = v.total > 0 ? ((v.unapproved / v.total) * 100).toFixed(1) : "—";
    typeFullRows.push([k, String(v.total), String(v.unapproved), rate]);
  }
  writeCsv("06_visitor_types.csv", typeFullRows);

  // ─── 7. Time-of-day heatmap ──────────────────────────────────────────
  console.log("\n━━━ 7. Time-of-day heatmap (hour buckets, IST) ━━━\n");
  // Hour in IST = (UTC hour + 5 hr 30 min). inTime stored as UTC Date.
  const hourBucket = (d: Date): number => {
    const utcH = d.getUTCHours();
    const utcM = d.getUTCMinutes();
    const istMin = utcH * 60 + utcM + 330;
    return Math.floor((istMin % 1440) / 60);
  };
  const hourTotals = new Array(24).fill(0);
  const hourUnapp = new Array(24).fill(0);
  const hourByBlock: Record<number, number[]> = {};
  for (const b of blocks) hourByBlock[b] = new Array(24).fill(0);
  for (const r of all) {
    if (!r.inTime) continue;
    const h = hourBucket(r.inTime);
    hourTotals[h]++;
    if (!r.approvedByResident) hourUnapp[h]++;
    if (r.block && hourByBlock[r.block]) hourByBlock[r.block][h]++;
  }
  const hrRows: string[][] = [["Hour", "Total", "Unapproved", "Rate%", "Blk1", "Blk2", "Blk3", "Blk4"]];
  for (let h = 0; h < 24; h++) {
    const label = `${String(h).padStart(2, "0")}:00`;
    const rate = hourTotals[h] > 0 ? ((hourUnapp[h] / hourTotals[h]) * 100).toFixed(1) : "—";
    hrRows.push([
      label,
      String(hourTotals[h]),
      String(hourUnapp[h]),
      rate,
      String(hourByBlock[1][h]),
      String(hourByBlock[2][h]),
      String(hourByBlock[3][h]),
      String(hourByBlock[4][h]),
    ]);
  }
  printTable(hrRows);
  writeCsv("07_hourly_heatmap.csv", hrRows);

  // Quick peak windows
  const slots = [
    { name: "Morning (6–10)", from: 6, to: 10 },
    { name: "Midday (10–14)", from: 10, to: 14 },
    { name: "Afternoon (14–18)", from: 14, to: 18 },
    { name: "Evening (18–22)", from: 18, to: 22 },
    { name: "Late-night (22–6)", from: 22, to: 6 },
  ];
  console.log("\n━━━ 7b. Time windows summary ━━━\n");
  const winRows: string[][] = [["Window", "Total", "Unapproved", "Rate%"]];
  for (const s of slots) {
    let tot = 0, un = 0;
    for (let h = 0; h < 24; h++) {
      const inRange = s.from < s.to ? (h >= s.from && h < s.to) : (h >= s.from || h < s.to);
      if (inRange) { tot += hourTotals[h]; un += hourUnapp[h]; }
    }
    const rate = tot > 0 ? ((un / tot) * 100).toFixed(1) : "—";
    winRows.push([s.name, String(tot), String(un), rate]);
  }
  printTable(winRows);
  writeCsv("07b_time_windows.csv", winRows);

  // ─── 8. Late-night entries (22:00–06:00) ─────────────────────────────
  console.log("\n━━━ 8. Late-night entries (22:00–06:00 IST) ━━━\n");
  const isLateNight = (d: Date | null): boolean => {
    if (!d) return false;
    const h = hourBucket(d);
    return h >= 22 || h < 6;
  };
  const lateNight = all.filter((r) => isLateNight(r.inTime));
  const lnApproved = lateNight.filter((r) => r.approvedByResident).length;
  const lnUnapproved = lateNight.length - lnApproved;
  console.log(`Total late-night: ${lateNight.length}  |  Approved: ${lnApproved}  |  Unapproved: ${lnUnapproved}`);

  console.log("\nBy block:");
  const lnBlockRows: string[][] = [["Block", "Total", "Approved", "Unapproved"]];
  for (const b of blocks) {
    const sub = lateNight.filter((r) => r.block === b);
    const ap = sub.filter((r) => r.approvedByResident).length;
    lnBlockRows.push([`Block ${b}`, String(sub.length), String(ap), String(sub.length - ap)]);
  }
  const caLN = lateNight.filter((r) => !r.block);
  const caLnAp = caLN.filter((r) => r.approvedByResident).length;
  lnBlockRows.push(["Common/Other", String(caLN.length), String(caLnAp), String(caLN.length - caLnAp)]);
  printTable(lnBlockRows);
  writeCsv("08a_latenight_by_block.csv", lnBlockRows);

  console.log("\nLate-night top visitor types:");
  const lnTypeCounts = new Map<string, { total: number; approved: number }>();
  for (const r of lateNight) {
    const k = r.visitorType || "(unknown)";
    const t = lnTypeCounts.get(k) ?? { total: 0, approved: 0 };
    t.total++;
    if (r.approvedByResident) t.approved++;
    lnTypeCounts.set(k, t);
  }
  const lnTypeSorted = Array.from(lnTypeCounts.entries()).sort((a, b) => b[1].total - a[1].total);
  const lnTypeRows: string[][] = [["Type", "Total", "Approved", "Unapproved"]];
  for (const [k, v] of lnTypeSorted.slice(0, 10)) {
    lnTypeRows.push([k, String(v.total), String(v.approved), String(v.total - v.approved)]);
  }
  printTable(lnTypeRows);
  const lnTypeFullRows: string[][] = [["Type", "Total", "Approved", "Unapproved"]];
  for (const [k, v] of lnTypeSorted) {
    lnTypeFullRows.push([k, String(v.total), String(v.approved), String(v.total - v.approved)]);
  }
  writeCsv("08b_latenight_by_type.csv", lnTypeFullRows);

  console.log("\nLate-night top sources (approved + unapproved combined):");
  const lnSrc = new Map<string, number>();
  for (const r of lateNight) {
    const s = normalizeSource(r.fromSource);
    lnSrc.set(s, (lnSrc.get(s) ?? 0) + 1);
  }
  const lnSrcSortedFull = Array.from(lnSrc.entries()).sort((a, b) => b[1] - a[1]);
  const lnSrcSorted = lnSrcSortedFull.slice(0, 10);
  const lnSrcRows: string[][] = [["Source", "Count"]];
  for (const [s, c] of lnSrcSorted) lnSrcRows.push([s, String(c)]);
  printTable(lnSrcRows);
  const lnSrcFullRows: string[][] = [["Source", "Count"]];
  for (const [s, c] of lnSrcSortedFull) lnSrcFullRows.push([s, String(c)]);
  writeCsv("08c_latenight_by_source.csv", lnSrcFullRows);

  // ─── 9. Weekday vs Weekend ───────────────────────────────────────────
  console.log("\n━━━ 9. Weekday vs Weekend ━━━\n");
  const isWeekend = (dateStr: string): boolean => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return dow === 0 || dow === 6;
  };
  const wdBuckets = { weekday: { total: 0, unapproved: 0, days: new Set<string>() },
                     weekend: { total: 0, unapproved: 0, days: new Set<string>() } };
  for (const r of all) {
    const k = isWeekend(r.visitDate) ? "weekend" : "weekday";
    wdBuckets[k].total++;
    wdBuckets[k].days.add(r.visitDate);
    if (!r.approvedByResident) wdBuckets[k].unapproved++;
  }
  const wdRows: string[][] = [["Bucket", "Days", "Total", "Avg/Day", "Unapproved", "Rate%"]];
  for (const k of ["weekday", "weekend"] as const) {
    const b = wdBuckets[k];
    const days = b.days.size || 1;
    const rate = b.total > 0 ? ((b.unapproved / b.total) * 100).toFixed(1) : "—";
    wdRows.push([k, String(b.days.size), String(b.total), (b.total / days).toFixed(1),
                 String(b.unapproved), rate]);
  }
  printTable(wdRows);
  writeCsv("09a_weekday_vs_weekend.csv", wdRows);

  console.log("\nPer day-of-week:");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowBuckets = new Map<number, { total: number; unapproved: number; days: Set<string> }>();
  for (let i = 0; i < 7; i++) dowBuckets.set(i, { total: 0, unapproved: 0, days: new Set() });
  for (const r of all) {
    const [y, m, d] = r.visitDate.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const b = dowBuckets.get(dow)!;
    b.total++;
    b.days.add(r.visitDate);
    if (!r.approvedByResident) b.unapproved++;
  }
  const dowRows: string[][] = [["Day", "Days", "Total", "Avg/Day", "Unapproved", "Rate%"]];
  for (let i = 0; i < 7; i++) {
    const b = dowBuckets.get(i)!;
    if (b.days.size === 0) continue;
    const rate = b.total > 0 ? ((b.unapproved / b.total) * 100).toFixed(1) : "—";
    dowRows.push([dayNames[i], String(b.days.size), String(b.total),
                  (b.total / b.days.size).toFixed(1),
                  String(b.unapproved), rate]);
  }
  printTable(dowRows);
  writeCsv("09b_day_of_week.csv", dowRows);

  console.log(`\n✅ CSVs written to ${CSV_DIR}\n`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
