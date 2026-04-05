import { prisma } from "../src/lib/prisma";

async function main() {
  const acceptances = await prisma.sosAcceptance.findMany({
    orderBy: { createdAt: "asc" },
  });

  const emails = acceptances.map((a) => a.email).filter(Boolean);
  const residents = await prisma.resident.findMany({
    where: { email: { in: emails } },
    select: { email: true, name: true },
  });
  const residentEmails = new Set(residents.map((r) => r.email));

  const missing = acceptances.filter((a) => !residentEmails.has(a.email));
  const existing = acceptances.filter((a) => residentEmails.has(a.email));

  console.log(`\n📋 Total SOS acceptances: ${acceptances.length}`);
  console.log(`✅ Already in resident DB: ${existing.length}`);
  console.log(`❌ Missing from resident DB: ${missing.length}\n`);

  if (missing.length > 0) {
    console.log("─────────────────────────────────────────────────────────────────────────");
    console.log(
      "# | Name                          | Email                          | Phone       | Block | Flat"
    );
    console.log("─────────────────────────────────────────────────────────────────────────");
    missing.forEach((a, i) => {
      console.log(
        `${String(i + 1).padStart(2)} | ${a.name.padEnd(30)} | ${a.email.padEnd(30)} | ${a.phone.padEnd(11)} | ${String(a.block).padEnd(5)} | ${a.flatNumber}`
      );
    });
    console.log("─────────────────────────────────────────────────────────────────────────");
  }

  await prisma.$disconnect();
}

main();
