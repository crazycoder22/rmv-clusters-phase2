import { prisma } from "../src/lib/prisma";

async function main() {
  const players = await prisma.wordlePlayer.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, phone: true, block: true, flatNumber: true },
  });

  const residentEmails = new Set(
    (await prisma.resident.findMany({ select: { email: true } })).map((r) =>
      r.email.toLowerCase()
    )
  );

  const missing = players.filter((p) => !residentEmails.has(p.email.toLowerCase()));
  const alreadyIn = players.filter((p) => residentEmails.has(p.email.toLowerCase()));

  console.log(`\nTotal Wordle players: ${players.length}`);
  console.log(`Already in resident DB: ${alreadyIn.length}`);
  console.log(`Missing from resident DB: ${missing.length}\n`);

  if (missing.length === 0) {
    console.log("✅ All Wordle players are already residents.");
    return;
  }

  console.log("Missing players:");
  missing.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} | ${p.email} | Block ${p.block}, Flat ${p.flatNumber} | Phone: ${p.phone}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
