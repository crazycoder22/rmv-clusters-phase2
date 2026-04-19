// Seed script: creates a "Bollywood Dialogue Quiz Night" announcement
// for tonight (19 April), and fans out notifications to every resident
// so it lights up their bell. Mirrors what POST /api/admin/announcements
// does internally.
//
// Run: npx tsx scripts/_seed-quiz-night-announcement.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const TITLE = "🎬 RMV Quiz Night Tonight — Bollywood Dialogues!";
const SUMMARY =
  "First-ever RMV online quiz! 9:00–9:30 PM tonight. Guess the movie from the dialogue.";
const BODY = `Good evening, RMVians!

As we continue to have important discussions on taking our community forward, we also want to make sure this journey is fun, lively, and full of laughter. After all, a strong community is built on both purpose and joy. 💚

🎭 RMV QUIZ NIGHT — Bollywood Edition!

📅 Tonight, Sunday 19th April
🕘 9:00 PM – 9:30 PM sharp
🎯 Theme: Guess the Movie from the Dialogue!

Wrap up dinner early and join us for the first-ever RMV online quiz — I'm super excited! 🍿

How to join: Visit https://www.rmvclustersphase2.in/quiz at 9 PM and enter the game code that will be shared on the WhatsApp group.

Picture abhi baaki hai mere dost! 🎥✨`;

async function main() {
  // Use the first SUPERADMIN as the announcement author. Falls back to
  // any resident if none found.
  const author = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });
  if (!author) {
    console.error("No SUPERADMIN found to set as the announcement author.");
    process.exit(1);
  }
  console.log(`Author: ${author.name}\n`);

  // Avoid creating a duplicate if the script is re-run.
  const existing = await prisma.announcement.findFirst({
    where: { title: TITLE },
  });
  if (existing) {
    console.log(`Announcement already exists (id: ${existing.id}). Skipping.`);
    console.log("Delete it from /admin first if you want to re-seed.");
    await prisma.$disconnect();
    return;
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: TITLE,
      date: new Date(), // now — i.e. tonight's announcement
      category: "event",
      priority: "high",
      summary: SUMMARY,
      body: BODY,
      author: author.name,
      emoji: "🎬",
      link: "/quiz",
      linkText: "Open Quiz Page",
      published: true,
    },
  });
  console.log(`✓ Created announcement: ${announcement.id}`);

  // Fan out notifications to every resident — same as the admin POST route.
  const residents = await prisma.resident.findMany({ select: { id: true } });
  const result = await prisma.notification.createMany({
    data: residents.map((r) => ({
      residentId: r.id,
      announcementId: announcement.id,
    })),
    skipDuplicates: true,
  });
  console.log(
    `✓ Notified ${result.count} resident${result.count === 1 ? "" : "s"} (out of ${residents.length} total)`
  );

  console.log(
    `\nDone! Visible at /news/${announcement.id} and on the home page.`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
