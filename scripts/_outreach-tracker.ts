/**
 * Initialize outreach tracker for unapproved visitor notifications.
 * Seeds from the unapproved-yesterday query.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import fs from "node:fs";

const TRACKER_PATH = "/tmp/visitor-outreach-2026-04-22.json";

type Status = "pending" | "sent" | "yet_to_send" | "no_residents";

interface TrackerEntry {
  block: number;
  flatNumber: string;
  status: Status;
  entries: Array<{ time: string; visitor: string; type: string; from: string; allowedByGuard: string }>;
  residents: Array<{ name: string; phone: string; type: string }>;
  notes?: string;
}

async function seed() {
  const date = "2026-04-22";

  const allLogs = await prisma.visitLog.findMany({
    where: { visitDate: date },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }, { inTime: "asc" }],
  });

  const approvalRequired = new Set(["Delivery Executive", "Visitor", "Cab", "Guest"]);
  const unapproved = allLogs.filter(
    (l) =>
      !l.approvedByResident &&
      l.block !== null &&
      l.flatNumber !== null &&
      approvalRequired.has(l.visitorType)
  );

  const byFlat = new Map<string, TrackerEntry>();
  for (const l of unapproved) {
    const key = `${l.block}-${l.flatNumber}`;
    if (!byFlat.has(key)) {
      byFlat.set(key, {
        block: l.block!,
        flatNumber: l.flatNumber!,
        status: "pending",
        entries: [],
        residents: [],
      });
    }
    byFlat.get(key)!.entries.push({
      time: l.inTime
        ? new Date(l.inTime.getTime() + 5.5 * 60 * 60 * 1000).toISOString().substring(11, 16)
        : "?",
      visitor: l.visitorName,
      type: l.visitorType,
      from: l.fromSource || "",
      allowedByGuard: l.allowedByGuard || "",
    });
  }

  const flatKeys = Array.from(byFlat.values()).map((f) => ({ block: f.block, flatNumber: f.flatNumber }));
  const residents = await prisma.resident.findMany({
    where: {
      OR: flatKeys.map((k) => ({ block: k.block, flatNumber: k.flatNumber })),
      isApproved: true,
    },
    select: { name: true, phone: true, block: true, flatNumber: true, residentType: true },
  });

  for (const f of byFlat.values()) {
    f.residents = residents
      .filter((r) => r.block === f.block && r.flatNumber === f.flatNumber)
      .map((r) => ({ name: r.name, phone: r.phone, type: r.residentType }));
    if (f.residents.length === 0) f.status = "no_residents";
  }

  const tracker = Array.from(byFlat.values()).sort((a, b) =>
    a.block !== b.block
      ? a.block - b.block
      : a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true })
  );

  fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2));
  console.log(`Tracker initialized: ${TRACKER_PATH}`);
  console.log(`Total flats: ${tracker.length}`);
  console.log(`  pending: ${tracker.filter((t) => t.status === "pending").length}`);
  console.log(`  no_residents: ${tracker.filter((t) => t.status === "no_residents").length}`);

  await prisma.$disconnect();
}

async function mark(block: number, flatNumber: string, status: Status, notes?: string) {
  const tracker: TrackerEntry[] = JSON.parse(fs.readFileSync(TRACKER_PATH, "utf-8"));
  const entry = tracker.find((t) => t.block === block && t.flatNumber === flatNumber);
  if (!entry) {
    console.error(`Flat ${block}-${flatNumber} not found`);
    process.exit(1);
  }
  entry.status = status;
  if (notes) entry.notes = notes;
  fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2));
  console.log(`Marked ${block}-${flatNumber} as ${status}${notes ? ` (${notes})` : ""}`);
}

async function show() {
  const tracker: TrackerEntry[] = JSON.parse(fs.readFileSync(TRACKER_PATH, "utf-8"));
  const counts: Record<string, number> = {};
  for (const t of tracker) counts[t.status] = (counts[t.status] || 0) + 1;
  console.log("Status summary:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log("\nPending flats:");
  for (const t of tracker.filter((t) => t.status === "pending")) {
    console.log(`  ${t.block}-${t.flatNumber} (${t.entries.length} entries, ${t.residents.length} residents)`);
  }
  console.log("\nYet-to-send flats:");
  for (const t of tracker.filter((t) => t.status === "yet_to_send")) {
    console.log(`  ${t.block}-${t.flatNumber} — ${t.notes || ""}`);
  }
}

const cmd = process.argv[2];
if (cmd === "seed") {
  seed();
} else if (cmd === "mark") {
  const [, , , block, flat, status, ...notes] = process.argv;
  mark(parseInt(block, 10), flat, status as Status, notes.join(" ")).then(() => process.exit(0));
} else if (cmd === "show") {
  show();
} else {
  console.log("Usage: tsx scripts/_outreach-tracker.ts seed | mark <block> <flat> <status> [notes] | show");
}
