import { prisma } from "../src/lib/prisma";

const SKIP_EMAILS = new Set(["ridhi@gmail.com"]);

const OVERRIDES: Record<string, { block?: number; flatNumber?: string }> = {
  "induright@gmail.com": { block: 4, flatNumber: "201" },
};

async function main() {
  const players = await prisma.wordlePlayer.findMany({
    orderBy: { createdAt: "asc" },
    select: { name: true, email: true, phone: true, block: true, flatNumber: true },
  });

  const residentEmails = new Set(
    (await prisma.resident.findMany({ select: { email: true } })).map((r) =>
      r.email.toLowerCase()
    )
  );

  const toAdd = players.filter(
    (p) =>
      !residentEmails.has(p.email.toLowerCase()) &&
      !SKIP_EMAILS.has(p.email.toLowerCase())
  );

  console.log(`\nAdding ${toAdd.length} Wordle players as residents...\n`);

  let added = 0;
  for (const p of toAdd) {
    const override = OVERRIDES[p.email.toLowerCase()] ?? {};
    const block = override.block ?? p.block;
    const flatNumber = override.flatNumber ?? p.flatNumber;

    await prisma.resident.create({
      data: {
        name: p.name,
        email: p.email.toLowerCase(),
        phone: p.phone,
        block,
        flatNumber,
        residentType: "TENANT",
        isApproved: true,
      },
    });

    console.log(`  ✅ ${p.name} (${p.email}) → Block ${block}, Flat ${flatNumber}`);
    added++;
  }

  console.log(`\nDone. Added ${added} residents.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
