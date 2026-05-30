import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Removes ONLY the demo initiatives created by _seed-initiatives.ts (tagged
// "[demo]" in the body). Cascade deletes their comments, replies, and likes.
// Real initiatives are untouched.
const MARK = "[demo]";

async function main() {
  const demo = await prisma.initiative.findMany({
    where: { body: { contains: MARK } },
    select: { id: true, title: true },
  });

  if (demo.length === 0) {
    console.log("No demo initiatives found — nothing to clear.");
    return;
  }

  const result = await prisma.initiative.deleteMany({
    where: { id: { in: demo.map((d) => d.id) } },
  });

  console.log("Cleared demo initiatives:");
  demo.forEach((d) => console.log(`   • ${d.title}`));
  console.log(`   → ${result.count} initiatives deleted (comments + replies + likes cascaded)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
