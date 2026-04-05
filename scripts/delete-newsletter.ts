import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.newsletter.delete({ where: { id: "cmmnsjdgf0000cv0xpw984fx4" } });
  console.log("✅ Newsletter deleted");
  await prisma.$disconnect();
}
main();
