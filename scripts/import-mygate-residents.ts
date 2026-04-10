/**
 * Import MyGate residents into the RMV database.
 *
 * Usage:
 *   npx tsx scripts/import-mygate-residents.ts --dry-run   # preview only
 *   npx tsx scripts/import-mygate-residents.ts             # write to DB
 *
 * Reads ~/Downloads/rmv-residents.csv (scraped from MyGate dashboard).
 * - Only rows with Status = Active are processed
 * - Flat format must be "<block 1-4> <flatNumber>" (e.g. "1 001/002")
 * - Phone is normalized to last 10 digits
 * - Match key = normalized phone number
 *   - If an existing resident matches by phone → update their email/name/flat/type
 *   - If not → create new resident with isApproved: true
 * - Missing Flat rows are upserted first
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import {
  RESIDENT_TYPES,
  type ResidentType,
} from "../src/lib/resident-types";

const CSV_PATH = join(homedir(), "Downloads", "rmv-residents.csv");
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Types ────────────────────────────────────────────────────────────────

interface CsvRow {
  Name: string;
  Flat: string;
  Status: string;
  "User Type": string;
  Mobile: string;
  Email: string;
  "Applied Date": string;
  "Approve Date": string;
  "Approved By": string;
  "Notification Status": string;
}

interface ValidRow {
  name: string;
  block: number;
  flatNumber: string;
  residentType: ResidentType;
  phone: string; // normalized to 10 digits
  email: string; // lowercase
  status: string;
}

// ─── CSV Parser (simple, handles quoted fields) ───────────────────────────

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
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row as unknown as CsvRow);
  }
  return rows;
}

// ─── Normalizers ──────────────────────────────────────────────────────────

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  if (last10 === "9999999999") return null; // placeholder
  return last10;
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

const TYPE_MAP: Record<string, ResidentType> = {
  Owner: "OWNER",
  "Owner Family": "OWNER_FAMILY",
  Tenant: "TENANT",
  "Tenant Family": "TENANT_FAMILY",
  "Multi Tenant": "MULTI_TENANT",
};

function mapUserType(raw: string): ResidentType | null {
  return TYPE_MAP[raw.trim()] ?? null;
}

function isValidEmail(raw: string): boolean {
  if (!raw) return false;
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith("[email")) return false; // Cloudflare obfuscation placeholder
  if (!lower.includes("@")) return false;
  if (!lower.includes(".")) return false;
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${DRY_RUN ? "🔍 DRY RUN" : "✏️  LIVE RUN"} — MyGate resident import\n`);
  console.log(`Reading CSV from ${CSV_PATH}...`);

  const csvText = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csvText);
  console.log(`  Found ${rows.length} total rows in CSV\n`);

  // ─── Filter + normalize ────────────────────────────────────────────────
  const skipped = {
    inactive: 0,
    invalidFlat: 0,
    invalidPhone: 0,
    invalidEmail: 0,
    invalidType: 0,
  };

  const valid: ValidRow[] = [];

  for (const row of rows) {
    if (row.Status !== "Active") {
      skipped.inactive++;
      continue;
    }
    const flat = parseFlat(row.Flat);
    if (!flat) {
      skipped.invalidFlat++;
      continue;
    }
    const phone = normalizePhone(row.Mobile);
    if (!phone) {
      skipped.invalidPhone++;
      continue;
    }
    if (!isValidEmail(row.Email)) {
      skipped.invalidEmail++;
      continue;
    }
    const residentType = mapUserType(row["User Type"]);
    if (!residentType) {
      skipped.invalidType++;
      continue;
    }
    valid.push({
      name: row.Name.trim(),
      block: flat.block,
      flatNumber: flat.flatNumber,
      residentType,
      phone,
      email: row.Email.trim().toLowerCase(),
      status: row.Status,
    });
  }

  console.log("Filter stats:");
  console.log(`  ✓ ${valid.length} valid rows`);
  console.log(`  ✗ ${skipped.inactive} inactive`);
  console.log(`  ✗ ${skipped.invalidFlat} invalid flat (COMMON AREA etc.)`);
  console.log(`  ✗ ${skipped.invalidPhone} invalid phone (masked, empty, 9999999999)`);
  console.log(`  ✗ ${skipped.invalidEmail} invalid email (empty or obfuscated)`);
  console.log(`  ✗ ${skipped.invalidType} invalid user type\n`);

  // ─── Type breakdown of valid rows ──────────────────────────────────────
  const typeBreakdown: Record<string, number> = {};
  for (const r of valid) {
    typeBreakdown[r.residentType] = (typeBreakdown[r.residentType] ?? 0) + 1;
  }
  console.log("Valid rows by residentType:");
  for (const t of RESIDENT_TYPES) {
    if (typeBreakdown[t]) console.log(`  ${t}: ${typeBreakdown[t]}`);
  }
  console.log();

  // ─── Phase A: Upsert flats ─────────────────────────────────────────────
  console.log("━━━ Phase A: Upserting flats ━━━");
  const uniqueFlats = new Map<string, { block: number; flatNumber: string }>();
  for (const r of valid) {
    const key = `${r.block}-${r.flatNumber}`;
    if (!uniqueFlats.has(key)) {
      uniqueFlats.set(key, { block: r.block, flatNumber: r.flatNumber });
    }
  }
  console.log(`  ${uniqueFlats.size} unique flats in valid rows`);

  const existingFlats = await prisma.flat.findMany({
    select: { block: true, flatNumber: true },
  });
  const existingFlatKeys = new Set(
    existingFlats.map((f) => `${f.block}-${f.flatNumber}`)
  );
  const flatsToCreate = Array.from(uniqueFlats.values()).filter(
    (f) => !existingFlatKeys.has(`${f.block}-${f.flatNumber}`)
  );

  console.log(`  ${existingFlatKeys.size} flats already exist in DB`);
  console.log(`  ${flatsToCreate.length} flats will be CREATED`);

  if (flatsToCreate.length > 0 && !DRY_RUN) {
    for (const f of flatsToCreate) {
      await prisma.flat.create({ data: f });
    }
    console.log(`  ✅ Created ${flatsToCreate.length} new flats`);
  } else if (DRY_RUN && flatsToCreate.length > 0) {
    console.log("  (dry-run) Would create:");
    for (const f of flatsToCreate.slice(0, 10)) {
      console.log(`    Block ${f.block}, ${f.flatNumber}`);
    }
    if (flatsToCreate.length > 10) {
      console.log(`    ... and ${flatsToCreate.length - 10} more`);
    }
  }
  console.log();

  // ─── Phase B: Upsert residents ─────────────────────────────────────────
  console.log("━━━ Phase B: Upserting residents ━━━");

  const existingResidents = await prisma.resident.findMany({
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      block: true,
      flatNumber: true,
      residentType: true,
    },
  });
  console.log(`  ${existingResidents.length} existing residents loaded`);

  // Lookup maps (use normalized keys)
  const byPhone = new Map<string, (typeof existingResidents)[number]>();
  const byEmail = new Map<string, (typeof existingResidents)[number]>();
  for (const r of existingResidents) {
    const phoneKey = normalizePhone(r.phone);
    if (phoneKey) {
      // If multiple residents share a phone, keep the first (we'll log conflicts)
      if (!byPhone.has(phoneKey)) byPhone.set(phoneKey, r);
    }
    byEmail.set(r.email.toLowerCase(), r);
  }

  // Ensure RESIDENT role exists
  const residentRole = await prisma.role.findUnique({
    where: { name: "RESIDENT" },
  });
  if (!residentRole) {
    console.error("  ❌ RESIDENT role not found in DB — aborting");
    return;
  }

  const stats = {
    created: 0,
    updated: 0,
    unchanged: 0,
    emailConflict: 0,
    emailExistsElsewhere: 0,
  };

  const conflicts: string[] = [];

  for (const row of valid) {
    const existing = byPhone.get(row.phone);

    if (existing) {
      // UPDATE path
      const updateData: {
        email?: string;
        name?: string;
        block?: number;
        flatNumber?: string;
        residentType?: string;
        phone?: string;
      } = {};

      // Email update — check for conflict
      if (row.email !== existing.email.toLowerCase()) {
        const emailOwner = byEmail.get(row.email);
        if (emailOwner && emailOwner.id !== existing.id) {
          conflicts.push(
            `EMAIL_CONFLICT: phone=${row.phone} name=${row.name} → trying to set email=${row.email} but that email belongs to ${emailOwner.name} (id=${emailOwner.id})`
          );
          stats.emailConflict++;
        } else {
          updateData.email = row.email;
        }
      }

      if (row.name && row.name !== existing.name) updateData.name = row.name;
      if (row.block !== existing.block) updateData.block = row.block;
      if (row.flatNumber !== existing.flatNumber) updateData.flatNumber = row.flatNumber;
      if (row.residentType !== existing.residentType) updateData.residentType = row.residentType;

      // Phone: normalize existing DB value, if it differs from stored, update to normalized form
      if (row.phone !== existing.phone) updateData.phone = row.phone;

      if (Object.keys(updateData).length === 0) {
        stats.unchanged++;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `  [update] ${row.name} (${row.phone}) → ${Object.keys(updateData).join(", ")}`
        );
      } else {
        await prisma.resident.update({
          where: { id: existing.id },
          data: updateData,
        });
        // keep in-memory maps fresh
        if (updateData.email) {
          byEmail.delete(existing.email.toLowerCase());
          byEmail.set(updateData.email, { ...existing, ...updateData, id: existing.id });
        }
      }
      stats.updated++;
    } else {
      // CREATE path
      const emailOwner = byEmail.get(row.email);
      if (emailOwner) {
        conflicts.push(
          `EMAIL_EXISTS_ELSEWHERE: phone=${row.phone} name=${row.name} email=${row.email} already belongs to ${emailOwner.name} (id=${emailOwner.id}, phone=${emailOwner.phone})`
        );
        stats.emailExistsElsewhere++;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `  [create] ${row.name} (${row.phone}) B${row.block}-${row.flatNumber} ${row.residentType}`
        );
      } else {
        try {
          const created = await prisma.resident.create({
            data: {
              name: row.name,
              email: row.email,
              phone: row.phone,
              block: row.block,
              flatNumber: row.flatNumber,
              residentType: row.residentType,
              isApproved: true,
              roles: { connect: { id: residentRole.id } },
            },
            select: {
              id: true,
              phone: true,
              email: true,
              name: true,
              block: true,
              flatNumber: true,
              residentType: true,
            },
          });
          // Add to maps so subsequent rows see it
          byPhone.set(row.phone, created);
          byEmail.set(row.email, created);
        } catch (err) {
          conflicts.push(
            `CREATE_FAILED: ${row.name} (${row.email}) — ${(err as Error).message}`
          );
          continue;
        }
      }
      stats.created++;
    }
  }

  console.log();
  console.log("━━━ Summary ━━━");
  console.log(`  ✅ Created:       ${stats.created}`);
  console.log(`  ✏️  Updated:       ${stats.updated}`);
  console.log(`  ⚪ Unchanged:     ${stats.unchanged}`);
  console.log(`  ⚠️  Email conflict (kept phone match): ${stats.emailConflict}`);
  console.log(`  ⚠️  Email exists elsewhere (skipped create): ${stats.emailExistsElsewhere}`);

  if (conflicts.length > 0) {
    console.log("\n━━━ Conflicts ━━━");
    for (const c of conflicts.slice(0, 30)) console.log(`  ${c}`);
    if (conflicts.length > 30) {
      console.log(`  ... and ${conflicts.length - 30} more`);
    }
  }

  console.log(
    `\n${DRY_RUN ? "🔍 Dry run complete — no DB changes made" : "✅ Import complete"}\n`
  );
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
