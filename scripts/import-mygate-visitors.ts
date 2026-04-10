/**
 * Import MyGate visitor entries into the RMV database (VisitLog table).
 *
 * Usage:
 *   npx tsx scripts/import-mygate-visitors.ts --dry-run   # preview only
 *   npx tsx scripts/import-mygate-visitors.ts             # write to DB
 *
 * Reads ~/Downloads/rmv-visitors-apr10.csv (or rename per weekly scrape).
 * - Dedup key: `MyGate ID` column → VisitLog.mygateId (unique)
 * - Re-running is idempotent (upsert by mygateId)
 * - Handles edge flat values: "COMMON AREA *", "View" (masked Guest)
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import { parseMyGateIstDateTime, toIstDateString } from "../src/lib/dates-ist";

const CSV_PATH = join(homedir(), "Downloads", "rmv-visitors-apr10.csv");
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Types ────────────────────────────────────────────────────────────────

interface CsvRow {
  "MyGate ID": string;
  Flat: string;
  Type: string;
  Name: string;
  From: string;
  "In Time": string;
  "Out Time": string;
  "Approved By": string;
  "Allowed By Guard": string;
}

interface NormalizedRow {
  mygateId: string;
  visitorName: string;
  visitorType: string;
  fromSource: string | null;
  block: number | null;
  flatNumber: string | null;
  flatRaw: string;
  inTime: Date | null;
  outTime: Date | null;
  approvedBy: string | null;
  allowedByGuard: string | null;
  approvedByResident: boolean;
  visitDate: string;
}

/** True when approvedBy is a non-empty string that does NOT match the guard
 * (case-insensitive, trimmed). These are real resident approvals, not guard
 * walk-throughs. */
function isApprovedByResident(approvedBy: string | null, allowedByGuard: string | null): boolean {
  if (!approvedBy) return false;
  const a = approvedBy.trim().toLowerCase();
  if (a.length === 0) return false;
  const g = (allowedByGuard ?? "").trim().toLowerCase();
  return a !== g;
}

// ─── CSV Parser (quoted-field aware) ──────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += c;
        }
      } else {
        if (c === ",") {
          cells.push(cur);
          cur = "";
        } else if (c === '"') {
          inQuotes = true;
        } else {
          cur += c;
        }
      }
    }
    cells.push(cur);
    return cells;
  };

  const headers = parseRow(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    rows.push(row as unknown as CsvRow);
  }
  return rows;
}

// ─── Normalizers ──────────────────────────────────────────────────────────

function parseFlat(raw: string): { block: number | null; flatNumber: string | null } {
  if (!raw) return { block: null, flatNumber: null };
  const trimmed = raw.trim();
  // Reject edge cases that aren't "<digit> <rest>"
  if (/^COMMON\s*AREA/i.test(trimmed)) return { block: null, flatNumber: null };
  if (/^View$/i.test(trimmed)) return { block: null, flatNumber: null };
  if (/^\(masked/i.test(trimmed)) return { block: null, flatNumber: null };
  // Extract "<1-4> <rest>"
  const m = trimmed.match(/^([1-4])\s+(.+)$/);
  if (!m) return { block: null, flatNumber: null };
  return { block: parseInt(m[1], 10), flatNumber: m[2].trim() };
}

function parseType(raw: string): string {
  if (!raw) return "";
  // "Visitor(Delivery Executive)" → "Delivery Executive"
  const m = raw.match(/^(.*?)\(([^)]+)\)$/);
  if (m) return m[2].trim();
  return raw.trim();
}

function nullIfEmpty(raw: string): string | null {
  const t = (raw ?? "").trim();
  return t.length === 0 ? null : t;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${DRY_RUN ? "🔍 DRY RUN" : "✏️  LIVE RUN"} — MyGate visitor import\n`);
  console.log(`Reading CSV from ${CSV_PATH}...`);

  const csvText = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csvText);
  console.log(`  Found ${rows.length} raw rows\n`);

  // ─── Normalize + dedup within CSV ──────────────────────────────────────
  const skipped = { noId: 0, noInTime: 0, dupInCsv: 0 };
  const byId = new Map<string, NormalizedRow>();

  for (const row of rows) {
    const mygateId = (row["MyGate ID"] || "").trim();
    if (!mygateId) { skipped.noId++; continue; }
    if (byId.has(mygateId)) { skipped.dupInCsv++; continue; }

    const inTime = parseMyGateIstDateTime(row["In Time"]);
    const outTime = parseMyGateIstDateTime(row["Out Time"]);
    if (!inTime) { skipped.noInTime++; continue; }

    const flatRaw = (row.Flat || "").trim();
    const { block, flatNumber } = parseFlat(flatRaw);
    const visitorType = parseType(row.Type);
    const visitDate = toIstDateString(inTime);

    const approvedBy = nullIfEmpty(row["Approved By"]);
    const allowedByGuard = nullIfEmpty(row["Allowed By Guard"]);
    byId.set(mygateId, {
      mygateId,
      visitorName: (row.Name || "").trim(),
      visitorType,
      fromSource: nullIfEmpty(row.From),
      block,
      flatNumber,
      flatRaw,
      inTime,
      outTime,
      approvedBy,
      allowedByGuard,
      approvedByResident: isApprovedByResident(approvedBy, allowedByGuard),
      visitDate,
    });
  }

  console.log("Filter stats:");
  console.log(`  ✓ ${byId.size} valid rows`);
  console.log(`  ✗ ${skipped.noId} missing MyGate ID`);
  console.log(`  ✗ ${skipped.noInTime} unparseable In Time`);
  console.log(`  ✗ ${skipped.dupInCsv} duplicates within CSV\n`);

  // ─── Fetch existing rows once ──────────────────────────────────────────
  const ids = Array.from(byId.keys());
  const existing = await prisma.visitLog.findMany({
    where: { mygateId: { in: ids } },
    select: {
      mygateId: true,
      visitDate: true,
      visitorName: true,
      visitorType: true,
      fromSource: true,
      block: true,
      flatNumber: true,
      flatRaw: true,
      inTime: true,
      outTime: true,
      approvedBy: true,
      allowedByGuard: true,
      approvedByResident: true,
    },
  });
  const existingById = new Map(existing.map((e) => [e.mygateId, e]));
  console.log(`Loaded ${existing.length} matching rows already in DB\n`);

  // ─── Process each normalized row ───────────────────────────────────────
  const stats = { created: 0, updated: 0, unchanged: 0, errors: 0 };
  const errors: string[] = [];

  for (const row of byId.values()) {
    try {
      const current = existingById.get(row.mygateId);

      if (!current) {
        // CREATE path
        if (DRY_RUN) {
          console.log(`  [create] ${row.mygateId} → ${row.visitorName} @ ${row.flatRaw} from ${row.fromSource ?? "-"}`);
        } else {
          await prisma.visitLog.create({
            data: {
              mygateId: row.mygateId,
              visitDate: row.visitDate,
              visitorName: row.visitorName,
              visitorType: row.visitorType,
              fromSource: row.fromSource,
              block: row.block,
              flatNumber: row.flatNumber,
              flatRaw: row.flatRaw,
              inTime: row.inTime,
              outTime: row.outTime,
              approvedBy: row.approvedBy,
              allowedByGuard: row.allowedByGuard,
              approvedByResident: row.approvedByResident,
            },
          });
        }
        stats.created++;
        continue;
      }

      // UPDATE path — diff mutable fields
      const diff: Record<string, unknown> = {};
      if (current.visitDate !== row.visitDate) diff.visitDate = row.visitDate;
      if (current.visitorName !== row.visitorName) diff.visitorName = row.visitorName;
      if (current.visitorType !== row.visitorType) diff.visitorType = row.visitorType;
      if ((current.fromSource ?? null) !== row.fromSource) diff.fromSource = row.fromSource;
      if ((current.block ?? null) !== row.block) diff.block = row.block;
      if ((current.flatNumber ?? null) !== row.flatNumber) diff.flatNumber = row.flatNumber;
      if (current.flatRaw !== row.flatRaw) diff.flatRaw = row.flatRaw;
      if ((current.inTime?.getTime() ?? null) !== (row.inTime?.getTime() ?? null)) diff.inTime = row.inTime;
      if ((current.outTime?.getTime() ?? null) !== (row.outTime?.getTime() ?? null)) diff.outTime = row.outTime;
      if ((current.approvedBy ?? null) !== row.approvedBy) diff.approvedBy = row.approvedBy;
      if ((current.allowedByGuard ?? null) !== row.allowedByGuard) diff.allowedByGuard = row.allowedByGuard;
      if (current.approvedByResident !== row.approvedByResident) diff.approvedByResident = row.approvedByResident;

      if (Object.keys(diff).length === 0) {
        stats.unchanged++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [update] ${row.mygateId} (${row.visitorName}) → ${Object.keys(diff).join(", ")}`);
      } else {
        await prisma.visitLog.update({
          where: { mygateId: row.mygateId },
          data: diff,
        });
      }
      stats.updated++;
    } catch (e) {
      stats.errors++;
      errors.push(`${row.mygateId}: ${(e as Error).message}`);
    }
  }

  console.log("\n━━━ Summary ━━━");
  console.log(`  ✅ Created:   ${stats.created}`);
  console.log(`  ✏️  Updated:   ${stats.updated}`);
  console.log(`  ⚪ Unchanged: ${stats.unchanged}`);
  console.log(`  ❌ Errors:    ${stats.errors}`);

  if (errors.length > 0) {
    console.log("\n━━━ Error details ━━━");
    for (const e of errors.slice(0, 20)) console.log(`  ${e}`);
    if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
  }

  console.log(
    `\n${DRY_RUN ? "🔍 Dry run complete — no DB changes" : "✅ Import complete"}\n`
  );
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
