/**
 * Compare flats from a MyGate residents CSV against the Flat table in DB.
 *
 * Usage:
 *   npx tsx scripts/diff-mygate-flats.ts                          # default CSV
 *   npx tsx scripts/diff-mygate-flats.ts --file <path>            # custom CSV
 *   npx tsx scripts/diff-mygate-flats.ts --include-inactive       # also count Inactive rows
 *
 * Flags mismatches between the two sets:
 *   - In CSV but not in DB  (need to create Flat row)
 *   - In DB but not in CSV  (orphan / no resident in MyGate)
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

function resolveCsvPath(): string {
  const fileIdx = process.argv.indexOf("--file");
  if (fileIdx >= 0 && process.argv[fileIdx + 1]) {
    return process.argv[fileIdx + 1];
  }
  return join(homedir(), "Downloads", "rmv-residents.csv");
}

const CSV_PATH = resolveCsvPath();
const INCLUDE_INACTIVE = process.argv.includes("--include-inactive");

interface CsvRow {
  Name: string;
  Flat: string;
  Status: string;
}

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
        } else cur += c;
      } else {
        if (c === ",") {
          cells.push(cur);
          cur = "";
        } else if (c === '"') {
          inQuotes = true;
        } else cur += c;
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
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row as unknown as CsvRow);
  }
  return rows;
}

function parseFlat(raw: string): { block: number; flatNumber: string } | null {
  if (!raw) return null;
  const idx = raw.indexOf(" ");
  if (idx === -1) return null;
  const blockStr = raw.slice(0, idx);
  const flatNumber = raw.slice(idx + 1).trim();
  if (!["1", "2", "3", "4"].includes(blockStr)) return null;
  if (!flatNumber) return null;
  return { block: parseInt(blockStr, 10), flatNumber };
}

function flatKey(block: number, flatNumber: string): string {
  return `${block}-${flatNumber}`;
}

async function main() {
  console.log(`\n🔎 Flat mismatch check\n`);
  console.log(`Reading CSV from ${CSV_PATH}...`);
  const csvText = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csvText);
  console.log(`  Found ${rows.length} CSV rows\n`);

  // ─── Build CSV flat set with row counts ────────────────────────────────
  const csvFlats = new Map<string, { block: number; flatNumber: string; count: number }>();
  let invalidFlatRows = 0;
  let inactiveSkipped = 0;
  for (const r of rows) {
    if (!INCLUDE_INACTIVE && r.Status !== "Active") {
      inactiveSkipped++;
      continue;
    }
    const f = parseFlat(r.Flat);
    if (!f) {
      invalidFlatRows++;
      continue;
    }
    const key = flatKey(f.block, f.flatNumber);
    const existing = csvFlats.get(key);
    if (existing) existing.count++;
    else csvFlats.set(key, { ...f, count: 1 });
  }

  console.log(`CSV stats:`);
  console.log(`  ${csvFlats.size} unique flats`);
  console.log(`  ${invalidFlatRows} rows with unparseable Flat (e.g. COMMON AREA)`);
  if (!INCLUDE_INACTIVE) console.log(`  ${inactiveSkipped} inactive rows skipped (use --include-inactive to include)`);
  console.log();

  // ─── Load DB flats ─────────────────────────────────────────────────────
  const dbFlatsRaw = await prisma.flat.findMany({
    select: { block: true, flatNumber: true },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }],
  });
  const dbFlats = new Map<string, { block: number; flatNumber: string }>();
  for (const f of dbFlatsRaw) {
    dbFlats.set(flatKey(f.block, f.flatNumber), f);
  }
  console.log(`DB stats:`);
  console.log(`  ${dbFlats.size} flats in Flat table\n`);

  // ─── Compute diffs ─────────────────────────────────────────────────────
  const inCsvNotDb: { block: number; flatNumber: string; count: number }[] = [];
  for (const [key, info] of csvFlats) {
    if (!dbFlats.has(key)) inCsvNotDb.push(info);
  }
  const inDbNotCsv: { block: number; flatNumber: string }[] = [];
  for (const [key, info] of dbFlats) {
    if (!csvFlats.has(key)) inDbNotCsv.push(info);
  }

  inCsvNotDb.sort((a, b) => a.block - b.block || a.flatNumber.localeCompare(b.flatNumber));
  inDbNotCsv.sort((a, b) => a.block - b.block || a.flatNumber.localeCompare(b.flatNumber));

  console.log("━━━ In CSV but NOT in DB ━━━");
  if (inCsvNotDb.length === 0) {
    console.log("  ✅ none");
  } else {
    for (const f of inCsvNotDb) {
      console.log(`  Block ${f.block} ${f.flatNumber}  (${f.count} resident${f.count > 1 ? "s" : ""} in CSV)`);
    }
    console.log(`  Total: ${inCsvNotDb.length}`);
  }
  console.log();

  console.log("━━━ In DB but NOT in CSV ━━━");
  if (inDbNotCsv.length === 0) {
    console.log("  ✅ none");
  } else {
    for (const f of inDbNotCsv) {
      console.log(`  Block ${f.block} ${f.flatNumber}`);
    }
    console.log(`  Total: ${inDbNotCsv.length}`);
  }
  console.log();

  console.log("━━━ Summary ━━━");
  console.log(`  CSV unique flats : ${csvFlats.size}`);
  console.log(`  DB  flats        : ${dbFlats.size}`);
  console.log(`  Common           : ${csvFlats.size - inCsvNotDb.length}`);
  console.log(`  Only in CSV      : ${inCsvNotDb.length}`);
  console.log(`  Only in DB       : ${inDbNotCsv.length}\n`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
