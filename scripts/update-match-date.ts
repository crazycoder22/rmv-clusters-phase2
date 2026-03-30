import { prisma } from "../src/lib/prisma";

async function main() {
  const updated = await prisma.fantasyMatch.update({
    where: { id: "cmncssrjk000004l4zbe7jey1" },
    data: { matchDate: new Date("2026-04-05T19:30:00+05:30") },
  });
  console.log("Updated matchDate:", updated.matchDate.toISOString());
  await prisma.$disconnect();
}
main();
