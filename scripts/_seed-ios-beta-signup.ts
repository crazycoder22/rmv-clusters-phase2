// Publish the iOS-app beta-tester sign-up as a PublicEvent + matching
// News announcement. Form requires email so we collect Apple IDs to
// invite over TestFlight.
//
// Run: npx tsx scripts/_seed-ios-beta-signup.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const SLUG = "ios-beta";
const TITLE = "RMV Clusters — iOS App Beta";
const ORGANIZER = "RMV Clusters Phase 2";
const VENUE = "Apple TestFlight";

// Treat this as a rolling sign-up; show a "starts" date but no end date.
const START = new Date(); // open from now

const DESCRIPTION = `We've built a native iOS app for RMV Clusters Phase 2 — News, Games, Polls, Issues, Visitor log, Community feed, all in one place — and we're putting it through TestFlight before submitting to the App Store.

If you have an iPhone, sign up below and we'll send you a TestFlight invite.

What you'll get:
• Early access to the iOS app
• A direct line to give us feedback (it auto-collects crash reports, plus a "Send Beta Feedback" button)

What we need from you:
• Your Apple ID email (the one you use on the App Store)
• Install the free **TestFlight** app from the App Store before your invite arrives
• Try things out for a week or so and let us know what breaks

Privacy: same as the website — Google sign-in for residents, no analytics, no third-party tracking. Read the full policy at https://www.rmvclustersphase2.in/privacy.`;

const ANN_TITLE = "📱 iOS App Beta — sign up now!";
const ANN_SUMMARY =
  "iPhone users — we're shipping a native RMV Clusters app. Sign up to get an early TestFlight invite. Need your Apple ID email.";

const ANN_BODY = `**📱 iOS App Beta — sign up now!**

We've been building a native iPhone app — News, Games, Polls, Issues, Visitor log, the Community feed, all in your pocket. Before we submit it to the App Store, we want a few of you to test it.

**Sign up here:**
https://www.rmvclustersphase2.in/events/${SLUG}

**What you need to do**
- Have an iPhone
- Install the free **TestFlight** app from the App Store
- Submit the form (we need your Apple ID email so the invite can find you)

You'll get the invite by email within a day. Try the app, find bugs, tell us what feels off — we'll incorporate the feedback before going public.

🙏 Android app is on the way — we'll have a similar beta when it's ready.`;

async function main() {
  const admin = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });
  if (!admin) {
    console.error("No SUPERADMIN found.");
    process.exit(1);
  }
  console.log(`Author: ${admin.name}\n`);

  // 1. PublicEvent
  const existing = await prisma.publicEvent.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Event already exists (id: ${existing.id}). Skipping.`);
  } else {
    const ev = await prisma.publicEvent.create({
      data: {
        slug: SLUG,
        title: TITLE,
        description: DESCRIPTION,
        organizer: ORGANIZER,
        venue: VENUE,
        startAt: START,
        endAt: null,
        registrationClosesAt: null,
        active: true,
        requireEmail: true,
        createdById: admin.id,
      },
    });
    console.log(`✓ Created event ${ev.id}`);
    console.log(`  Public URL: /events/${ev.slug}`);
    console.log(`  Admin URL:  /admin/public-events/${ev.id}\n`);
  }

  // 2. Announcement
  const existingAnn = await prisma.announcement.findFirst({
    where: { title: ANN_TITLE },
  });
  if (existingAnn) {
    console.log(`Announcement already exists (id: ${existingAnn.id}). Skipping.`);
  } else {
    const ann = await prisma.announcement.create({
      data: {
        title: ANN_TITLE,
        date: new Date(),
        category: "general",
        priority: "normal",
        summary: ANN_SUMMARY,
        body: ANN_BODY,
        author: admin.name,
        emoji: "📱",
        link: `/events/${SLUG}`,
        linkText: "Sign up for beta",
        published: true,
      },
    });
    console.log(`✓ Created announcement ${ann.id}`);

    const residents = await prisma.resident.findMany({ select: { id: true } });
    const fanout = await prisma.notification.createMany({
      data: residents.map((r) => ({
        residentId: r.id,
        announcementId: ann.id,
      })),
      skipDuplicates: true,
    });
    console.log(`✓ Notified ${fanout.count} resident(s)`);
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
