import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const eventConfigId = "cmn1trll6000104jo8wgzwe8y"; // SOS Warriors event

  // Get guest RSVPs
  const guestRsvps = await prisma.guestRsvp.findMany({
    where: { eventConfigId },
  });

  console.log(`Found ${guestRsvps.length} guest RSVPs to convert to residents\n`);

  let created = 0;
  let skipped = 0;

  for (const g of guestRsvps) {
    // Check if resident already exists with this email
    const existing = await prisma.resident.findUnique({
      where: { email: g.email },
    });

    if (existing) {
      console.log(`SKIP: ${g.name} (${g.email}) - already a resident`);
      skipped++;
      continue;
    }

    // Create resident
    const resident = await prisma.resident.create({
      data: {
        email: g.email,
        name: g.name,
        phone: g.phone,
        block: g.block,
        flatNumber: g.flatNumber,
        residentType: "OWNER", // default, user can change later
        isSosWarrior: true,
        isApproved: true,
      },
    });

    console.log(`CREATED: ${resident.name} (${resident.email}) - Block ${resident.block}, Flat ${resident.flatNumber}`);
    created++;
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
