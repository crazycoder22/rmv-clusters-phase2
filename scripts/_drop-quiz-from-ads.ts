// One-off: strip "quiz" from the pages[] array of every active Ad row
// so the admin form's view matches reality (we removed <AdBanner /> from
// /quiz, so an ad targeting "quiz" would never render anyway).
//
// Run: npx tsx scripts/_drop-quiz-from-ads.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  const ads = await prisma.ad.findMany({
    where: { pages: { has: "quiz" } },
    select: { id: true, title: true, pages: true },
  });
  if (ads.length === 0) {
    console.log("No ads target /quiz. Nothing to do.");
    await prisma.$disconnect();
    return;
  }
  console.log(`Found ${ads.length} ad(s) targeting /quiz:`);
  for (const a of ads) {
    const newPages = a.pages.filter((p) => p !== "quiz");
    await prisma.ad.update({
      where: { id: a.id },
      data: { pages: newPages },
    });
    console.log(`  ✓ ${a.title} — pages now: [${newPages.join(", ")}]`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
