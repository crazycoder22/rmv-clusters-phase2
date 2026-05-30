// One-off: visitor-approval engagement stats per flat.
//
//   - "Never approved" = flats that got visits but approved NONE of them
//   - "Always approve" = flats that approved 100% of visits to them, PLUS
//                        flats with zero visits (benefit of the doubt —
//                        they haven't had a chance to skip approval)
//   - "Some"           = mixed (some approved, some not)
//
// Run: npx tsx scripts/_flats-never-approved.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const flatKey = (block: number, flat: string) => `B${block}-${flat}`;

async function main() {
  // ── 1. Universe of flats — distinct (block, flatNumber) from Resident ────
  const residents = await prisma.resident.findMany({
    select: { block: true, flatNumber: true },
  });

  const universe = new Set<string>();
  const byBlock = new Map<number, Set<string>>();
  for (const r of residents) {
    const key = flatKey(r.block, r.flatNumber);
    universe.add(key);
    if (!byBlock.has(r.block)) byBlock.set(r.block, new Set());
    byBlock.get(r.block)!.add(r.flatNumber);
  }

  // ── 2. All visits to known flats, counted per-flat ────────────────────────
  // Lifetime totals — "always" / "never" are natural lifetime measures.
  const visits = await prisma.visitLog.findMany({
    where: { block: { not: null }, flatNumber: { not: null } },
    select: { block: true, flatNumber: true, approvedByResident: true },
  });

  // Per-flat counters: { total, approved } — only for flats we actually see
  // a visit to. Flats with zero visits won't appear here.
  const perFlat = new Map<string, { total: number; approved: number }>();
  for (const v of visits) {
    if (v.block == null || v.flatNumber == null) continue;
    const k = flatKey(v.block, v.flatNumber);
    const row = perFlat.get(k) ?? { total: 0, approved: 0 };
    row.total += 1;
    if (v.approvedByResident) row.approved += 1;
    perFlat.set(k, row);
  }

  // ── 3. Classify every universe flat ──────────────────────────────────────
  // NB: flats with zero visits roll into "always approve" by convention —
  // they've never had a chance to *fail* to approve, so they get the benefit
  // of the doubt.
  const neverApproved = new Set<string>(); // total > 0 AND approvals == 0
  const alwaysApprove = new Set<string>(); // total == 0, OR approvals == total (>0)
  const someApprove = new Set<string>();   // 0 < approvals < total
  const noVisits = new Set<string>();      // total == 0 (shown as a sub-count)

  for (const f of universe) {
    const row = perFlat.get(f);
    if (!row || row.total === 0) {
      noVisits.add(f);
      alwaysApprove.add(f); // zero-visits → always (benefit of the doubt)
    } else if (row.approved === 0) {
      neverApproved.add(f);
    } else if (row.approved === row.total) {
      alwaysApprove.add(f);
    } else {
      someApprove.add(f);
    }
  }

  const pct = (n: number) =>
    universe.size > 0 ? Math.round((n / universe.size) * 100) : 0;

  console.log(`\nUniverse of flats (from Resident table): ${universe.size}`);
  console.log(`\nFlats that have NEVER approved (had visits, approved 0): ${neverApproved.size}  (${pct(neverApproved.size)}%)`);
  console.log(`Flats that ALWAYS approve: ${alwaysApprove.size}  (${pct(alwaysApprove.size)}%)`);
  console.log(`  └ ${alwaysApprove.size - noVisits.size} actually approved all of their visits`);
  console.log(`  └ ${noVisits.size} had zero visits (counted here by convention)`);
  console.log(`Flats with a mix (sometimes approved): ${someApprove.size}  (${pct(someApprove.size)}%)`);

  // ── 4. Breakdown by block ─────────────────────────────────────────────────
  console.log("\nBy block (never / always / some / total):");
  const blocks = Array.from(byBlock.keys()).sort((a, b) => a - b);
  for (const b of blocks) {
    const flats = byBlock.get(b)!;
    let nNever = 0, nAlways = 0, nSome = 0;
    for (const flat of flats) {
      const k = flatKey(b, flat);
      if (neverApproved.has(k)) nNever += 1;
      else if (alwaysApprove.has(k)) nAlways += 1;
      else if (someApprove.has(k)) nSome += 1;
    }
    console.log(
      `  Block ${b}: ${nNever.toString().padStart(3)} never  |  ${nAlways
        .toString()
        .padStart(3)} always  |  ${nSome.toString().padStart(3)} some  |  ${flats.size} total`
    );
  }

  // ── 5. Samples so the user can spot-check ────────────────────────────────
  const sortFlats = (s: Set<string>) =>
    Array.from(s).sort((a, b) => {
      const [ba, fa] = a.replace("B", "").split("-");
      const [bb, fb] = b.replace("B", "").split("-");
      return parseInt(ba) - parseInt(bb) || fa.localeCompare(fb);
    });

  if (neverApproved.size > 0) {
    const list = sortFlats(neverApproved);
    console.log(`\nFirst ${Math.min(15, list.length)} NEVER-approved flats:`);
    console.log("  " + list.slice(0, 15).join(", "));
    if (list.length > 15) console.log(`  … and ${list.length - 15} more`);
  }

  if (alwaysApprove.size > 0) {
    const list = sortFlats(alwaysApprove);
    console.log(`\nFirst ${Math.min(15, list.length)} ALWAYS-approve flats:`);
    console.log("  " + list.slice(0, 15).join(", "));
    if (list.length > 15) console.log(`  … and ${list.length - 15} more`);
  }

  // ── 6. Footnote on what's NOT counted ────────────────────────────────────
  console.log(
    `\nNote: "universe" is distinct (block, flat) pairs in the Resident table.`
  );
  console.log(
    `      A flat with multiple residents counts once. Flats never registered`
  );
  console.log(`      by any resident on the site are not in the universe at all.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
