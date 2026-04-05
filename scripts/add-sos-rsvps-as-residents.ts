import { prisma } from "../src/lib/prisma";

async function main() {
  const residentRole = await prisma.role.findUnique({ where: { name: "RESIDENT" } });
  if (!residentRole) throw new Error("RESIDENT role not found");

  const toAdd = [
    { name: "VIJAYA SUNDAR",        email: "vijayasundar1944@gmail.com", phone: "9008090589", block: 3, flatNumber: "101" },
    { name: "Vinayak Vithob Mahale",email: "vinayakvmahale@gmail.com",   phone: "9766412850", block: 4, flatNumber: "508" },
    { name: "Bindu Zacharia",       email: "zachiein@yahoo.com",         phone: "9940350674", block: 2, flatNumber: "104/105" },
    { name: "Shruti Anil",          email: "ashrutika86@gmail.com",      phone: "8277552864", block: 2, flatNumber: "003" },
    { name: "Sarojini S Pai",       email: "sarojinipai29@gmail.com",    phone: "9972930159", block: 4, flatNumber: "511" },
    { name: "Renuka Verma",         email: "renukaverma3@gmail.com",     phone: "9341308196", block: 3, flatNumber: "506" },
    { name: "MALLIKARJUNAN M M",    email: "mallikarjunan.mm@gmail.com", phone: "9980117560", block: 1, flatNumber: "205" },
    { name: "Rakhi Chaturvedi",     email: "rakhichat71@gmail.com",      phone: "9442017414", block: 2, flatNumber: "301/302" },
    { name: "Manvi",                email: "manvib1977@gmail.com",       phone: "9343009982", block: 3, flatNumber: "310/311" },
  ];

  let added = 0, skipped = 0;

  for (const r of toAdd) {
    try {
      const resident = await prisma.resident.create({
        data: {
          name: r.name, email: r.email, phone: r.phone, block: r.block,
          flatNumber: r.flatNumber, residentType: "TENANT", isApproved: true,
          roles: { connect: { id: residentRole.id } },
        },
      });
      await prisma.sosAcceptance.updateMany({
        where: { email: r.email },
        data: { residentId: resident.id },
      });
      console.log(`✅ Added: ${r.name} (${r.email}) — Block ${r.block} / ${r.flatNumber}`);
      added++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`⚠️  Skipped: ${r.name} — ${msg.includes("Unique") ? "email already exists" : msg.substring(0, 80)}`);
      skipped++;
    }
  }

  console.log(`\n✅ Added: ${added}  |  ⚠️  Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main();
