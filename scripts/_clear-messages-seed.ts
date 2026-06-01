import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Removes ONLY the demo conversations created by _seed-messages.ts — any
// conversation containing a "[demo]"-tagged message. Cascade deletes messages.
async function main() {
  const tagged = await prisma.directMessage.findMany({
    where: { body: { contains: "[demo]" } },
    select: { conversationId: true },
    distinct: ["conversationId"],
  });

  if (tagged.length === 0) {
    console.log("No demo conversations found — nothing to clear.");
    return;
  }

  const result = await prisma.conversation.deleteMany({
    where: { id: { in: tagged.map((t) => t.conversationId) } },
  });
  console.log(`Cleared ${result.count} demo conversation(s) (messages cascaded).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
