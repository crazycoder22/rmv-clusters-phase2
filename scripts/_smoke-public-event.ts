// Smoke test the public event registration path without going through HTTP.
// Replays what the route handler does (validate + create + count) end-to-end.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const SLUG = "hearing-checkup-apr-2026";

async function main() {
  // Fetch the event (the GET route does this + returns count).
  const event = await prisma.publicEvent.findUnique({
    where: { slug: SLUG },
    select: {
      id: true,
      title: true,
      active: true,
      registrationClosesAt: true,
      _count: { select: { registrations: true } },
    },
  });
  if (!event) {
    console.error("Event not found — run _seed-hearing-camp.ts first.");
    process.exit(1);
  }
  console.log(`Event: ${event.title}`);
  console.log(`Registrations so far: ${event._count.registrations}\n`);

  // Simulate a registration (we'll delete it right after).
  const fake = await prisma.publicEventRegistration.create({
    data: {
      eventId: event.id,
      name: "Smoke Test",
      phone: "9999999999",
      block: 1,
      flatNumber: "TEST",
    },
  });
  console.log(`✓ Created fake registration (id=${fake.id})`);

  const after = await prisma.publicEventRegistration.count({
    where: { eventId: event.id },
  });
  console.log(`Count after: ${after}`);

  // Clean up — we don't want a "Smoke Test" row in the CSV handed to Amplifon.
  await prisma.publicEventRegistration.delete({ where: { id: fake.id } });
  console.log(`✓ Cleaned up fake registration`);

  const final = await prisma.publicEventRegistration.count({
    where: { eventId: event.id },
  });
  console.log(`Count final: ${final}\n`);
  if (final === event._count.registrations) {
    console.log("All good — count matches baseline.");
  } else {
    console.error("Count mismatch! Something stray was left behind.");
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
