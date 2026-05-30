import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const MARK = "[demo]";

async function main() {
  const me = await prisma.resident.findFirst({
    where: { email: "lakshmankamathk@gmail.com" },
  });
  if (!me) throw new Error("your resident record not found");

  // Idempotent: wipe any prior demo slots first.
  const old = await prisma.parkingSlot.findMany({
    where: { description: { contains: MARK } },
    select: { id: true },
  });
  if (old.length) {
    const ids = old.map((s) => s.id);
    await prisma.parkingBooking.deleteMany({ where: { slotId: { in: ids } } });
    await prisma.parkingBlock.deleteMany({ where: { slotId: { in: ids } } });
    await prisma.parkingSlot.deleteMany({ where: { id: { in: ids } } });
    console.log(`cleared ${ids.length} previous demo slots`);
  }

  const others = await prisma.resident.findMany({
    where: { isApproved: true, id: { not: me.id } },
    take: 4,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (others.length === 0) throw new Error("no other approved residents to own demo slots");
  const pick = (i: number) => others[i % others.length];

  const specs = [
    { owner: pick(0), label: "Basement B2 - 14", location: "Near Tower B lift", hourlyRate: 30, payInfo: "demo-owner1@okaxis", extra: "" },
    { owner: pick(1), label: "Stilt - S7", location: "Visitor bay, Tower A", hourlyRate: 20, payInfo: "9800000001", extra: "" },
    { owner: pick(2), label: "Open lot - 22", location: "Behind clubhouse", hourlyRate: 25, payInfo: "demo-owner3@upi", extra: "Compact cars only" },
    { owner: pick(3), label: "Basement B1 - 03", location: "Ramp side", hourlyRate: 40, payInfo: "demo-owner4@okhdfc", extra: "" },
  ];

  const created: { id: string; label: string; owner: string; rate: number }[] = [];
  for (const s of specs) {
    const slot = await prisma.parkingSlot.create({
      data: {
        ownerId: s.owner.id,
        label: s.label,
        location: s.location,
        hourlyRate: s.hourlyRate,
        payInfo: s.payInfo,
        active: true,
        description: (s.extra ? s.extra + " · " : "") + MARK,
      },
    });
    created.push({ id: slot.id, label: slot.label, owner: s.owner.name, rate: s.hourlyRate });
  }

  // One slot owned by YOU — to test the owner view + printable QR.
  const mine = await prisma.parkingSlot.create({
    data: {
      ownerId: me.id,
      label: "My slot - A 09",
      location: "Tower C, level 1",
      hourlyRate: 35,
      payInfo: "your-upi@bank",
      active: true,
      description: "Test your owner view + QR · " + MARK,
    },
  });

  // An existing booking on slot #1 (by another resident) so YOU see a "busy" window.
  const booker = pick(1);
  const start = new Date(Date.now() + 24 * 3600 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3 * 3600 * 1000);
  await prisma.parkingBooking.create({
    data: {
      slotId: created[0].id,
      bookerId: booker.id,
      startAt: start,
      endAt: end,
      status: "BOOKED",
      hourlyRateSnapshot: 30,
      totalAmount: 90,
      vehicleNumber: "KA01AB1234",
    },
  });

  console.log("\n✅ Created demo parking:");
  created.forEach((c) => console.log(`   • ${c.label} — ₹${c.rate}/hr — owner ${c.owner}`));
  console.log(`   • (yours) ${mine.label} — ₹35/hr`);
  console.log(`   + 1 existing booking on ${created[0].label} tomorrow ${start.toLocaleTimeString("en-IN")}–${end.toLocaleTimeString("en-IN")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
