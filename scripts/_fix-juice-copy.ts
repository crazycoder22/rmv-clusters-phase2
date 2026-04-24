// One-shot: rewrite "every one of our housekeeping, security and gardener
// team" → "our staff" in the seeded PublicEvent description and the
// matching Announcement body/summary. Safe to re-run — it's a plain
// string replace against the same records.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

const SLUG = "summer-staff-juice";
const ANN_TITLE = "🍋 Summer Lemon Juice for Our Staff — pledge now!";

const OLD_LONG = "every one of our housekeeping, security and gardener team";
const NEW_LONG = "our staff";

async function main() {
  const event = await prisma.publicEvent.findUnique({ where: { slug: SLUG } });
  if (event?.description?.includes(OLD_LONG)) {
    const next = event.description.replaceAll(OLD_LONG, NEW_LONG);
    await prisma.publicEvent.update({
      where: { id: event.id },
      data: { description: next },
    });
    console.log("✓ Updated PublicEvent description");
  } else {
    console.log("• PublicEvent description already up to date");
  }

  const ann = await prisma.announcement.findFirst({ where: { title: ANN_TITLE } });
  if (ann) {
    const summaryFixed =
      ann.summary?.replaceAll(OLD_LONG, NEW_LONG) ?? ann.summary;
    const bodyFixed = ann.body?.replaceAll(OLD_LONG, NEW_LONG) ?? ann.body;
    if (summaryFixed !== ann.summary || bodyFixed !== ann.body) {
      await prisma.announcement.update({
        where: { id: ann.id },
        data: { summary: summaryFixed, body: bodyFixed },
      });
      console.log("✓ Updated Announcement summary+body");
    } else {
      console.log("• Announcement already up to date");
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
