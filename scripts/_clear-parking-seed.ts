import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const MARK = "[demo]";

// Removes ONLY the demo parking data created by _seed-parking.ts. Demo slots
// are tagged with "[demo]" in their description; we delete those slots plus
// any bookings/blocks attached to them. Real resident data is untouched.
async function main() {
  const demo = await prisma.parkingSlot.findMany({
    where: { description: { contains: MARK } },
    select: { id: true, label: true },
  });

  if (demo.length === 0) {
    console.log("No demo parking slots found — nothing to clear.");
    return;
  }

  const ids = demo.map((s) => s.id);
  const bookings = await prisma.parkingBooking.deleteMany({ where: { slotId: { in: ids } } });
  const blocks = await prisma.parkingBlock.deleteMany({ where: { slotId: { in: ids } } });
  const slots = await prisma.parkingSlot.deleteMany({ where: { id: { in: ids } } });

  console.log("Cleared demo parking data:");
  demo.forEach((s) => console.log(`   • ${s.label}`));
  console.log(`   → ${slots.count} slots, ${bookings.count} bookings, ${blocks.count} blocks deleted`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
