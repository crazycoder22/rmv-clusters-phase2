import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const tokens = await prisma.deviceToken.findMany({
    include: { resident: { select: { name: true, email: true } } },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
  });

  console.log(`\n=== DeviceToken rows: ${tokens.length} ===\n`);

  if (tokens.length === 0) {
    console.log("(empty — no device has registered for push yet)");
    console.log("\nLikely causes:");
    console.log("  1. Build 8 hasn't been installed on any phone yet");
    console.log("  2. The user tapped 'Don't Allow' on the iOS prompt");
    console.log("  3. /api/push/register is failing (check Vercel logs)");
  } else {
    for (const t of tokens) {
      console.log({
        id: t.id,
        platform: t.platform,
        residentName: t.resident.name,
        residentEmail: t.resident.email,
        lastSeenAt: t.lastSeenAt.toISOString(),
        tokenLength: t.token.length,
        tokenPreview: t.token.slice(0, 20) + "..." + t.token.slice(-10),
      });
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
