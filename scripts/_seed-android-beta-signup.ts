// Publish the OneRMV Android beta-tester sign-up as a PublicEvent +
// matching News announcement. Mirrors the iOS beta event but collects
// the tester's *Google* account email (the one tied to Play Store)
// instead of an Apple ID.
//
// Run: npx tsx scripts/_seed-android-beta-signup.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const SLUG = "android-beta";
const TITLE = "OneRMV — Android App Beta";
const ORGANIZER = "RMV Clusters Phase 2";
const VENUE = "Google Play Internal Testing";

const START = new Date(); // open from now

const DESCRIPTION = `OneRMV is coming to Android! 🎉 If you're on Android and want early access, sign up below — we'll add you to Google Play's internal testing list so the app installs and updates just like any regular Play Store app (no sideloading, no "unknown sources" toggles).

Once you're in, you'll get a link to opt in. Tap it from your phone, accept, and the Play Store installs OneRMV for you.

What you'll get:
• Early access to OneRMV on Android
• Full feature set — News, Games, Polls, Issues, Visitors, Community feed, Anagram, all of it
• Auto-updates as we ship fixes

What we need from you:
• Your **Google account email** — the one you sign into Play Store with (Settings → Google → your account name on your phone)
• Play Store installed (it already is on every Android phone)
• A week of casual use, plus telling us what feels off

Privacy: same as the website — Google sign-in for residents, no analytics, no third-party tracking. Read the full policy at https://www.rmvclustersphase2.in/privacy.`;

const ANN_TITLE = "🤖 OneRMV Android Beta — sign up now!";
const ANN_SUMMARY =
  "Android users — OneRMV is coming. Sign up to get added to Google Play internal testing. Need your Google account email (the one tied to Play Store).";

const ANN_BODY = `**🤖 OneRMV Android Beta — sign up now!**

OneRMV (the new RMV Clusters Phase 2 app — News, Games, Polls, Issues, Visitors, Community feed, all in one place) is heading to Android. Before we go public, we want a few of you to try it.

**Sign up here:**
https://www.rmvclustersphase2.in/events/${SLUG}

**What you need to do**
- Have an Android phone (any model from the last ~5 years works)
- Submit the form — we need your **Google account email** (the one tied to your Play Store)

You'll get an opt-in link by email within a day. Tap it from your phone → accept → Play Store installs OneRMV like any regular app. Auto-updates as we ship fixes.

iOS folks — your beta is already running. Both versions are catching up to the website feature-for-feature.

🙏`;

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
  const existing = await prisma.publicEvent.findUnique({
    where: { slug: SLUG },
  });
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
    console.log(
      `Announcement already exists (id: ${existingAnn.id}). Skipping.`
    );
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
        emoji: "🤖",
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
