import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import {
  parseMygateDate,
  parseFlat,
  parseDurationMinutes,
  parseIntSafe,
  isOpenStatus,
  strOrNull,
} from "../src/lib/mygate";

// One-time import of the MyGate Help Desk report. Idempotent: upserts on
// mygateId, so re-running with a fresh export updates existing rows.
// Usage: npx tsx scripts/import-mygate-complaints.ts [path-to-json]

type Row = Record<string, string | null>;

async function main() {
  const path = process.argv[2] || join(__dirname, ".data", "mygate-complaints.json");
  const rows: Row[] = JSON.parse(readFileSync(path, "utf8"));
  console.log(`Read ${rows.length} rows from ${path}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    const mygateId = strOrNull(r["Id"]);
    const subject = strOrNull(r["Subject"]) ?? "(no subject)";
    if (!mygateId) {
      skipped++;
      continue;
    }
    const flat = parseFlat(r["Flat"]);
    const status = strOrNull(r["Status"]) ?? "Unknown";

    const data = {
      subject,
      category: strOrNull(r["Category"]),
      subCategory: strOrNull(r["Sub Category"]),
      type: strOrNull(r["Type"]),
      block: flat.block,
      flatNumber: flat.flatNumber,
      flatRaw: flat.flatRaw,
      createdBy: strOrNull(r["Created By"]),
      status,
      isOpen: isOpenStatus(status),
      assignee: strOrNull(r["Assignee"]),
      updatedUser: strOrNull(r["Updated User"]),
      escalationLevel: strOrNull(r["Escalation Level"]),
      comments: strOrNull(r["Comments"]),
      mygateCreatedAt: parseMygateDate(r["Created Date"]),
      lastUpdateAt: parseMygateDate(r["Last Update"]),
      closedAt: parseMygateDate(r["Closed Time"]),
      resolutionMinutes: parseDurationMinutes(r["Resolution Tat (Rtat)"]),
      onHoldMinutes: parseDurationMinutes(r["On Hold Time"]),
      reopenCount: parseIntSafe(r["Reopen Count"]) ?? 0,
      rating: parseIntSafe(r["Rating"]),
      raw: r as object,
    };

    const existing = await prisma.mygateComplaint.findUnique({
      where: { mygateId },
      select: { id: true },
    });
    await prisma.mygateComplaint.upsert({
      where: { mygateId },
      create: { mygateId, ...data },
      update: data,
    });
    if (existing) updated++;
    else created++;
  }

  const total = await prisma.mygateComplaint.count();
  console.log(`Done. created=${created} updated=${updated} skipped=${skipped}. Table now has ${total} complaints.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
