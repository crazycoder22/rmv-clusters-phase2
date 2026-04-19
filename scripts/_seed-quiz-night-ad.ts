// Seed script: insert a banner ad for tonight's Bollywood Quiz Night.
// Targets every page that renders <AdBanner>, with today as both start
// and end date so it auto-expires after midnight IST.
//
// Run: npx tsx scripts/_seed-quiz-night-ad.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const TITLE = "🎬 Bollywood Quiz Night — Tonight 9 PM!";
const DESCRIPTION =
  "Guess the movie from the dialogue. Tap to join.";
const IMAGE_URL = "/banners/quiz-night-bollywood.svg";
const LINK_URL = "/quiz";

// Pages that render <AdBanner /> AND are appropriate for a quiz-night
// promo. We deliberately leave /quiz out — players who land there are
// already in the quiz flow and don't need the banner.
const PAGES = ["wordle", "sudoku", "crossword", "memory", "2048", "news"];

// Today in IST as YYYY-MM-DD (matches the format /api/ads filters on).
function istToday(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000 + now.getTimezoneOffset() * 60 * 1000;
  return new Date(istMs).toISOString().split("T")[0];
}

async function main() {
  const today = istToday();
  console.log(`Today (IST): ${today}\n`);

  // Avoid duplicates if the script re-runs.
  const existing = await prisma.ad.findFirst({ where: { title: TITLE } });
  if (existing) {
    console.log(`Ad already exists (id: ${existing.id}). Skipping.`);
    console.log("Delete it from /admin/ads if you want to re-seed.");
    await prisma.$disconnect();
    return;
  }

  // Create one "top" placement and one "bottom" placement so the banner
  // shows above AND below the game UI. Same image, same dates, same
  // pages — just different placement value.
  const top = await prisma.ad.create({
    data: {
      title: TITLE,
      description: DESCRIPTION,
      imageUrl: IMAGE_URL,
      linkUrl: LINK_URL,
      placement: "top",
      pages: PAGES,
      startDate: today,
      endDate: today,
      active: true,
    },
  });
  console.log(`✓ Created TOP banner: ${top.id}`);

  const bottom = await prisma.ad.create({
    data: {
      title: TITLE,
      description: DESCRIPTION,
      imageUrl: IMAGE_URL,
      linkUrl: LINK_URL,
      placement: "bottom",
      pages: PAGES,
      startDate: today,
      endDate: today,
      active: true,
    },
  });
  console.log(`✓ Created BOTTOM banner: ${bottom.id}`);

  console.log(`\nVisible on: ${PAGES.join(", ")}`);
  console.log(`Active until end of ${today}.`);
  console.log(`Manage from /admin/ads.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
