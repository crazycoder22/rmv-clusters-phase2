/**
 * Export all approved residents as a vCard (.vcf) file for contact import.
 * - First name = resident full name
 * - Last name = B{block}-{flatNumber} (e.g. B2-102)
 * - Dedup by normalized phone; if same phone lives in multiple flats, join them
 * - Adds +91 prefix to Indian mobile numbers
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  if (digits.length === 11 && digits.startsWith("0"))
    return "+91" + digits.substring(1);
  return null; // drop malformed numbers
}

function escapeVcf(s: string): string {
  // vCard escape: backslash, comma, semicolon, newline
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

async function main() {
  const residents = await prisma.resident.findMany({
    where: { isApproved: true },
    select: {
      name: true,
      phone: true,
      block: true,
      flatNumber: true,
    },
  });

  // Group by normalized phone
  type Entry = { names: Set<string>; flats: Set<string> };
  const byPhone = new Map<string, Entry>();

  let skipped = 0;
  for (const r of residents) {
    const phone = normalizePhone(r.phone);
    if (!phone) {
      skipped++;
      continue;
    }
    if (!byPhone.has(phone)) {
      byPhone.set(phone, { names: new Set(), flats: new Set() });
    }
    const e = byPhone.get(phone)!;
    e.names.add(r.name.trim());
    e.flats.add(`B${r.block}-${r.flatNumber}`);
  }

  // Build vCards
  const lines: string[] = [];
  for (const [phone, e] of byPhone.entries()) {
    // Pick longest name for display (often most complete / formal)
    const name = Array.from(e.names).sort((a, b) => b.length - a.length)[0];
    // Flats: join with comma if multiple
    const flats = Array.from(e.flats).sort().join(", ");

    const lastName = escapeVcf(flats);
    const firstName = escapeVcf(name);
    const fullName = escapeVcf(`${name} ${flats}`);

    lines.push("BEGIN:VCARD");
    lines.push("VERSION:3.0");
    lines.push(`N:${lastName};${firstName};;;`);
    lines.push(`FN:${fullName}`);
    lines.push(`TEL;TYPE=CELL:${phone}`);
    lines.push("END:VCARD");
  }

  const vcfContent = lines.join("\r\n") + "\r\n";

  // Write to Downloads for easy access
  const outPath = path.join(os.homedir(), "Downloads", "rmv-residents.vcf");
  fs.writeFileSync(outPath, vcfContent);

  console.log(`vCard written: ${outPath}`);
  console.log(`  Residents in DB (approved): ${residents.length}`);
  console.log(`  Unique phone numbers: ${byPhone.size}`);
  console.log(`  Skipped (invalid phone): ${skipped}`);

  // Show phone-duplicates in our data
  const dups = Array.from(byPhone.entries()).filter(
    ([, e]) => e.names.size > 1 || e.flats.size > 1
  );
  if (dups.length > 0) {
    console.log(`\n  Merged entries (same phone → multiple names/flats):`);
    for (const [phone, e] of dups.slice(0, 20)) {
      console.log(
        `    ${phone}: names=[${Array.from(e.names).join(
          ", "
        )}] flats=[${Array.from(e.flats).join(", ")}]`
      );
    }
    if (dups.length > 20) console.log(`    ...and ${dups.length - 20} more`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
