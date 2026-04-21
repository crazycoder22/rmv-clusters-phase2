// One-off: change the hearing-camp venue from "Club House" to
// "Block Office" in both the PublicEvent row and the related
// Announcement body.
//
// Run: npx tsx scripts/_update-hearing-camp-venue.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const SLUG = "hearing-checkup-apr-2026";
const OLD_VENUE = "Club House — RMV Clusters Phase 2";
const NEW_VENUE = "Block Office — RMV Clusters Phase 2";
const ANN_TITLE = "🎧 Free Hearing Check-up Camp — Register now!";

async function main() {
  // 1. PublicEvent row.
  const event = await prisma.publicEvent.findUnique({ where: { slug: SLUG } });
  if (!event) {
    console.error(`No public event with slug "${SLUG}".`);
    process.exit(1);
  }
  if (event.venue === NEW_VENUE) {
    console.log(`PublicEvent.venue already set to "${NEW_VENUE}" — nothing to do.`);
  } else {
    const updated = await prisma.publicEvent.update({
      where: { id: event.id },
      data: { venue: NEW_VENUE },
    });
    console.log(`✓ PublicEvent.venue updated`);
    console.log(`   from: ${event.venue}`);
    console.log(`   to:   ${updated.venue}`);
  }

  // 2. Matching Announcement body — "Club House" appears in summary + body.
  const ann = await prisma.announcement.findFirst({ where: { title: ANN_TITLE } });
  if (!ann) {
    console.log(`No announcement "${ANN_TITLE}" found — skipping announcement update.`);
  } else {
    const newSummary = ann.summary.replace(/Club House/g, "Block Office");
    const newBody = ann.body
      .replace(new RegExp(OLD_VENUE.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), NEW_VENUE)
      .replace(/\bClub House\b/g, "Block Office");

    if (newSummary === ann.summary && newBody === ann.body) {
      console.log(`Announcement text already up to date — nothing to do.`);
    } else {
      await prisma.announcement.update({
        where: { id: ann.id },
        data: { summary: newSummary, body: newBody },
      });
      console.log(`✓ Announcement summary + body updated (id=${ann.id})`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
