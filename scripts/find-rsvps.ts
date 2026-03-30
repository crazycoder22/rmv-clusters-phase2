import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find SOS Warrior event
  const events = await prisma.announcement.findMany({
    where: {
      OR: [
        { title: { contains: "sos", mode: "insensitive" } },
        { title: { contains: "warrior", mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, eventConfig: { select: { id: true } } },
  });
  console.log("Events found:", JSON.stringify(events, null, 2));

  if (events.length === 0) {
    console.log("No SOS Warrior events found");
    return;
  }

  for (const event of events) {
    if (!event.eventConfig) continue;
    const ecId = event.eventConfig.id;

    // Get resident RSVPs
    const rsvps = await prisma.rsvp.findMany({
      where: { eventConfigId: ecId },
      include: { resident: { select: { id: true, name: true, email: true } } },
    });
    console.log(`\nResident RSVPs for "${event.title}" (${rsvps.length}):`);
    rsvps.forEach((r) =>
      console.log(`  - ${r.resident.name} (${r.resident.email})`)
    );

    // Get guest RSVPs
    const guestRsvps = await prisma.guestRsvp.findMany({
      where: { eventConfigId: ecId },
    });
    console.log(`\nGuest RSVPs for "${event.title}" (${guestRsvps.length}):`);
    guestRsvps.forEach((g) =>
      console.log(
        `  - ${g.name} (${g.email}) phone:${g.phone} block:${g.block} flat:${g.flatNumber}`
      )
    );
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
