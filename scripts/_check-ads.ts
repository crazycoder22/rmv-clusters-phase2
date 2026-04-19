import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { prisma } from "../src/lib/prisma";

async function main() {
  const ads = await prisma.ad.findMany({
    select: {
      id: true,
      title: true,
      placement: true,
      pages: true,
      active: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`Total ads: ${ads.length}\n`);
  for (const a of ads) {
    console.log(`• ${a.title}`);
    console.log(`  id=${a.id}  placement=${a.placement}  active=${a.active}  ${a.startDate}→${a.endDate}`);
    console.log(`  pages=[${a.pages.join(", ")}]`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
