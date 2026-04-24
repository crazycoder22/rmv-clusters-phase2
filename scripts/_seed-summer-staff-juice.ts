// Seed the "Summer Lemon Juice for Staff" crowdsourcing event + matching
// Announcement. Contribution fields are pre-configured; UPI + QR are left
// empty so the admin fills them in via the /admin/public-events/[id]
// settings panel before sharing.
//
// Run: npx tsx scripts/_seed-summer-staff-juice.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const SLUG = "summer-staff-juice";
const TITLE = "Summer Lemon Juice for Our Staff 🍋";
const ORGANIZER = "RMV Clusters Phase 2";
const VENUE = "Daily, at the main gate";

// Monday 27 Apr 2026 → Saturday 31 May 2026 (IST)
const START = new Date("2026-04-26T18:30:00.000Z"); // 27 Apr 00:00 IST
const END = new Date("2026-05-31T18:29:59.000Z"); // 31 May 23:59:59 IST

// Form closes Sunday 26 Apr 2026 at 8pm IST
const CLOSES_AT = new Date("2026-04-26T14:30:00.000Z"); // 20:00 IST

const MAX_CONTRIBUTION = 800;
const TARGET_AMOUNT = 14000; // 20 staff × ₹20 × 35 days

const DESCRIPTION = `The sun is out, and it's brutal. Let's make sure every one of our housekeeping, security and gardener team gets a fresh glass of lemon juice each day through summer.

Plan:
• 20 staff × ₹20 per glass × 1 glass a day
• Starts Monday 27 April, runs until 31 May (35 days)
• Target: ₹14,000

You can contribute up to ₹800 — we've capped it so every resident gets a chance to participate. If we raise more than ₹14,000, we'll keep the practice going past May until the money runs out.

How it works:
1. Pledge your contribution using the form below
2. Pay via UPI using the QR code or UPI ID shown
3. That's it — an admin will mark your pledge as paid once the money arrives. No need to ping anyone.

Form closes on Sunday, 26 April at 8:00 PM.`;

const ANN_TITLE = "🍋 Summer Lemon Juice for Our Staff — pledge now!";
const ANN_SUMMARY =
  "Let's give our housekeeping, security & gardener team a fresh glass of lemon juice every day this summer. Target ₹14,000, max ₹800 per person. Form closes Sun 8 PM.";

const ANN_BODY = `🍋 **Summer Lemon Juice — for our staff, by us**

The heat is brutal right now. Let's make sure every one of our housekeeping, security and gardener team gets a fresh glass of lemon juice every day through summer.

**Plan**
• 20 staff × ₹20 per glass × 1 glass/day
• Mon 27 Apr → Sat 31 May (35 days)
• Target: ₹14,000

Pledge at the link below — contribute **up to ₹800** (so everyone gets a chance). Pay via the UPI / QR shown on the page. Admin will mark your pledge as paid once received.

**Form closes Sunday 26 April, 8:00 PM.**

If we raise more than ₹14,000, we continue the practice past May until the kitty runs out. 🙌

Open to everyone — residents, family, neighbours. Every rupee counts.`;

async function main() {
  const admin = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });
  if (!admin) {
    console.error("No SUPERADMIN found. Aborting.");
    process.exit(1);
  }
  console.log(`Creator: ${admin.name}\n`);

  // ── 1. PublicEvent ────────────────────────────────────────────────────────
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
        registrationClosesAt: CLOSES_AT,
        active: true,
        contributionEnabled: true,
        maxContribution: MAX_CONTRIBUTION,
        targetAmount: TARGET_AMOUNT,
        paymentInstructions:
          "Please include 'Juice' in the UPI note so we can match the payment to your pledge.",
        // upiId + paymentQrImageUrl to be filled via the admin UI
        createdById: admin.id,
      },
    });
    console.log(`✓ Created event ${ev.id}`);
    console.log(`  Public URL: /events/${ev.slug}`);
    console.log(`  Admin URL: /admin/public-events/${ev.id}`);
    console.log(
      `  (Set UPI + upload QR from the admin page before sharing.)\n`
    );
  }

  // ── 2. Announcement ───────────────────────────────────────────────────────
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
        category: "general",
        priority: "high",
        summary: ANN_SUMMARY,
        body: ANN_BODY,
        author: admin.name,
        emoji: "🍋",
        link: `/events/${SLUG}`,
        linkText: "Pledge now",
        published: true,
      },
    });
    console.log(`✓ Created announcement ${announcement.id}`);

    // Fan out notifications
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
