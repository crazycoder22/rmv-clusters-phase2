import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Removes ONLY the demo referendums created by _seed-referendums.ts (tagged
// "[demo]" in the body). Cascade deletes their options + ballots. Real
// referendums are untouched.
const MARK = "[demo]";

async function main() {
  const demo = await prisma.referendum.findMany({
    where: { body: { contains: MARK } },
    select: { id: true, title: true },
  });

  if (demo.length === 0) {
    console.log("No demo referendums found — nothing to clear.");
    return;
  }

  const result = await prisma.referendum.deleteMany({
    where: { id: { in: demo.map((d) => d.id) } },
  });

  console.log("Cleared demo referendums:");
  demo.forEach((d) => console.log(`   • ${d.title}`));
  console.log(`   → ${result.count} referendums deleted (options + ballots cascaded)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
