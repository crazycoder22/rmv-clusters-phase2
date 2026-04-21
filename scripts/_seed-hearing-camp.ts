// Seed the Free Hearing Check-up Camp public event + a matching
// Announcement that fans out notifications to every resident.
// Run: npx tsx scripts/_seed-hearing-camp.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const SLUG = "hearing-checkup-apr-2026";
const TITLE = "Free Hearing Check-up Camp";
const ORGANIZER = "Amplifon India";
const VENUE = "Block Office — RMV Clusters Phase 2";

// Times in IST (UTC+5:30): 10:00 AM – 4:00 PM on 26 April 2026.
const START = new Date("2026-04-26T04:30:00.000Z"); // 10:00 AM IST
const END = new Date("2026-04-26T10:30:00.000Z");   // 4:00 PM IST

const DESCRIPTION = `Take a proactive step towards a healthier life with our Free Hearing Check Camp, proudly organised by Amplifon India.

FREE services available:
• Advanced hearing test by certified experts
• One-on-one expert consultation

Why you should attend:
• Early detection of hearing loss & health risks
• Helps reduce chances of stress, anxiety & memory-related issues
• Improve your overall quality of life
• Safe, quick & professionally conducted tests

Bring your parents, grandparents & loved ones — because good hearing and good health are priceless.`;

// Announcement body — a little softer so it reads well in the feed.
const ANNOUNCEMENT_SUMMARY =
  "Sunday 26 April, 10 AM – 4 PM at the Block Office. Free tests by certified experts from Amplifon India. Register online — no login needed.";

const ANNOUNCEMENT_BODY = `🎧 Free Hearing Check-up Camp — This Sunday!

Take a proactive step towards a healthier life. We're hosting a FREE hearing check-up camp at the Block Office this Sunday, organised by Amplifon India.

📅 Sunday, 26 April 2026
⏰ 10:00 AM – 4:00 PM
📍 Block Office — RMV Clusters Phase 2

What you get (all free):
• Advanced hearing test by certified experts
• One-on-one expert consultation

Bring your parents, grandparents and loved ones along. Good hearing = good health.

Register in 30 seconds — no login needed:
https://www.rmvclustersphase2.in/events/${SLUG}

You can share the registration link with anyone — family, friends, neighbours from nearby societies are all welcome.`;

async function main() {
  // Use the first SUPERADMIN as the creator/author.
  const admin = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });
  if (!admin) {
    console.error("No SUPERADMIN found.");
    process.exit(1);
  }
  console.log(`Creator: ${admin.name}\n`);

  // ── 1. PublicEvent ──────────────────────────────────────────────────────
  const existingEvent = await prisma.publicEvent.findUnique({
    where: { slug: SLUG },
  });
  if (existingEvent) {
    console.log(`Event already exists (id: ${existingEvent.id}). Skipping.`);
  } else {
    const ev = await prisma.publicEvent.create({
      data: {
        slug: SLUG,
        title: TITLE,
        description: DESCRIPTION,
        organizer: ORGANIZER,
        venue: VENUE,
        startAt: START,
        endAt: END,
        active: true,
        createdById: admin.id,
      },
    });
    console.log(`✓ Created event ${ev.id}`);
    console.log(`  Public URL: /events/${ev.slug}`);
  }

  // ── 2. Announcement (fan-out notifications) ─────────────────────────────
  const ANN_TITLE = "🎧 Free Hearing Check-up Camp — Register now!";
  const existingAnn = await prisma.announcement.findFirst({
    where: { title: ANN_TITLE },
  });
  if (existingAnn) {
    console.log(`Announcement already exists (id: ${existingAnn.id}). Skipping.`);
  } else {
    const announcement = await prisma.announcement.create({
      data: {
        title: ANN_TITLE,
        date: new Date(),
        category: "event",
        priority: "high",
        summary: ANNOUNCEMENT_SUMMARY,
        body: ANNOUNCEMENT_BODY,
        author: admin.name,
        emoji: "🎧",
        link: `/events/${SLUG}`,
        linkText: "Register for the camp",
        published: true,
      },
    });
    console.log(`\n✓ Created announcement ${announcement.id}`);

    const residents = await prisma.resident.findMany({ select: { id: true } });
    const n = await prisma.notification.createMany({
      data: residents.map((r) => ({
        residentId: r.id,
        announcementId: announcement.id,
      })),
      skipDuplicates: true,
    });
    console.log(`✓ Notified ${n.count} resident(s)`);
  }

  console.log(`\nDone. Visit /events/${SLUG} to see the public page.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
