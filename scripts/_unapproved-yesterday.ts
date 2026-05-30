/**
 * Find flats with unapproved visitor/delivery/cab entries from yesterday,
 * grouped by flat, with resident phone numbers for WhatsApp outreach.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const date = "2026-04-22";

  // Pull all VisitLog rows for the date
  const allLogs = await prisma.visitLog.findMany({
    where: { visitDate: date },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }, { inTime: "asc" }],
  });

  // Types that need resident approval: Visitor types & Delivery & Cab
  // Skip regular staff (Cook, Daily Help, Handyman, etc.)
  const approvalRequiredTypes = new Set([
    "Delivery Executive",
    "Visitor",
    "Cab",
    "Guest",
  ]);

  // Filter to entries where approval was needed but not given by resident
  const unapproved = allLogs.filter(
    (l) =>
      !l.approvedByResident &&
      l.block !== null &&
      l.flatNumber !== null &&
      approvalRequiredTypes.has(l.visitorType)
  );

  // Group by block + flatNumber
  const byFlat = new Map<
    string,
    {
      block: number;
      flatNumber: string;
      entries: typeof unapproved;
    }
  >();
  for (const l of unapproved) {
    const key = `${l.block}-${l.flatNumber}`;
    if (!byFlat.has(key)) {
      byFlat.set(key, { block: l.block!, flatNumber: l.flatNumber!, entries: [] });
    }
    byFlat.get(key)!.entries.push(l);
  }

  // Get residents for each flat
  const flatKeys = Array.from(byFlat.values()).map((f) => ({
    block: f.block,
    flatNumber: f.flatNumber,
  }));

  const residents = await prisma.resident.findMany({
    where: {
      OR: flatKeys.map((k) => ({
        block: k.block,
        flatNumber: k.flatNumber,
      })),
      isApproved: true,
    },
    select: {
      name: true,
      phone: true,
      block: true,
      flatNumber: true,
      residentType: true,
    },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }, { name: "asc" }],
  });

  // Merge residents into flat groups
  const result = Array.from(byFlat.values())
    .sort((a, b) =>
      a.block !== b.block
        ? a.block - b.block
        : a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true })
    )
    .map((f) => ({
      block: f.block,
      flatNumber: f.flatNumber,
      entryCount: f.entries.length,
      entries: f.entries.map((e) => ({
        time: e.inTime
          ? new Date(e.inTime.getTime() + 5.5 * 60 * 60 * 1000)
              .toISOString()
              .replace("T", " ")
              .substring(11, 16)
          : "?",
        visitor: e.visitorName,
        type: e.visitorType,
        from: e.fromSource || "",
        allowedByGuard: e.allowedByGuard || "",
      })),
      residents: residents
        .filter((r) => r.block === f.block && r.flatNumber === f.flatNumber)
        .map((r) => ({ name: r.name, phone: r.phone, type: r.residentType })),
    }));

  console.log(JSON.stringify(result, null, 2));
  console.log(`\n━━━ Summary ━━━`);
  console.log(`Flats with unapproved entries: ${result.length}`);
  console.log(`Total unapproved entries: ${unapproved.length}`);
  console.log(
    `Flats with no registered residents: ${
      result.filter((r) => r.residents.length === 0).length
    }`
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
