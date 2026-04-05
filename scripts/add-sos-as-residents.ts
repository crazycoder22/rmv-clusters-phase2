import { prisma } from "../src/lib/prisma";

async function main() {
  // Get the RESIDENT role
  const residentRole = await prisma.role.findUnique({ where: { name: "RESIDENT" } });
  if (!residentRole) throw new Error("RESIDENT role not found in DB");

  // All 31 missing entries with corrections applied
  const toAdd = [
    { name: "Deepika Dechamma",      email: "deepikadech.aa30@gmail.com",    phone: "8277277768",  block: 2, flatNumber: "111" },
    { name: "Tulasi Shetty",         email: "shetty.tulsi10@gmail.com",      phone: "7259866866",  block: 1, flatNumber: "503" },
    { name: "Rajeshwari kamath",     email: "rajeshwarim.64@gmail.com",      phone: "9901472718",  block: 3, flatNumber: "002/003" }, // fixed email
    { name: "Bindhu A N",            email: "bindhunash@gmail.com",          phone: "9676814440",  block: 1, flatNumber: "106" },
    { name: "Sharada Philar",        email: "philar.sharada@gmail.com",      phone: "6361960551",  block: 2, flatNumber: "101/102" },
    { name: "Pramila Patil",         email: "pramilanakate88@gmail.com",     phone: "7411030226",  block: 4, flatNumber: "203" },
    { name: "Minnie Bhargav",        email: "minnie_r@rediffmail.com",       phone: "9902160533",  block: 1, flatNumber: "409/410" },
    { name: "Arun Kumar",            email: "arunkumar.thak@gmail.com",      phone: "8511323132",  block: 4, flatNumber: "310" },
    { name: "Bijay Kumar",           email: "bijay.pydipati@outlook.com",    phone: "9845387600",  block: 3, flatNumber: "502/503" },
    { name: "Agneedh Basu",          email: "agneedh9532@gmail.com",         phone: "9632489134",  block: 1, flatNumber: "103" },
    { name: "Prathiksha Kamath",     email: "dummy@gmail.com",               phone: "9035914112",  block: 1, flatNumber: "006" }, // dummy email
    { name: "Ashish Kumar",          email: "a.kumar1995@gmail.com",         phone: "9706995518",  block: 4, flatNumber: "002" },
    { name: "Lalita Mani",           email: "lalla_mani@yahoo.com",          phone: "9886395169",  block: 4, flatNumber: "408" },
    { name: "Mithu Salim",           email: "mithzdreamz@gmail.com",         phone: "7760881818",  block: 3, flatNumber: "105" },
    { name: "Govind Bhat P",         email: "govindbhatp@gmail.com",         phone: "9972367238",  block: 3, flatNumber: "301" },
    { name: "Sukanya Gopinath",      email: "svorkady@gmail.com",            phone: "9845672317",  block: 1, flatNumber: "401/402" },
    { name: "Aditi",                 email: "aditiraman26@gmail.com",        phone: "9902121134",  block: 4, flatNumber: "107" },
    { name: "Nishitha Karumbaiah",   email: "nish.karumbaiah@gmail.com",     phone: "9535735750",  block: 3, flatNumber: "601" },
    { name: "Vinu",                  email: "vinu.careerpath@gmail.com",     phone: "9945953698",  block: 2, flatNumber: "510" },
    { name: "Nandini Mahale",        email: "nandinivmahale@gmail.com",      phone: "9970554434",  block: 4, flatNumber: "508" },
    { name: "Shilpa N Rao",          email: "shilparao17@gmail.com",         phone: "9886170531",  block: 3, flatNumber: "205" },
    { name: "Ashitha u shetty",      email: "ashithaumesh@gmail.com",        phone: "9449019034",  block: 2, flatNumber: "311" },
    { name: "Priyanka Bansal",       email: "bansalpriyanka0921@gmail.com",  phone: "9368063423",  block: 4, flatNumber: "102" },
    { name: "Radha arun",            email: "radha_arun05@yahoo.com",        phone: "9986704269",  block: 1, flatNumber: "407/408" },
    { name: "Elizabeth",             email: "elizabeth.shaju@gmail.com",     phone: "9900264795",  block: 2, flatNumber: "310" },
    { name: "Supriya Bhat",          email: "supriyanayak.a@gmail.com",      phone: "7760063960",  block: 2, flatNumber: "109" },
    { name: "Somanna K B",           email: "eshasomanna@gmail.com",         phone: "7022841008",  block: 3, flatNumber: "601" },
    { name: "Sushmi sakineti",       email: "sushmisakineti7@gmail.com",     phone: "9121273333",  block: 3, flatNumber: "001" },
    { name: "Sthirendranath Pai K",  email: "kspai17@gmail.com",             phone: "9901681611",  block: 4, flatNumber: "511" },
    { name: "Rachana Satish",        email: "rachana.k.satish@gmail.com",    phone: "7259505694",  block: 1, flatNumber: "306" },
    { name: "Sriram Parameswaran",   email: "oryzain@gmail.com",             phone: "9591006549",  block: 1, flatNumber: "209/210" },
  ];

  let added = 0, skipped = 0;

  for (const r of toAdd) {
    try {
      const resident = await prisma.resident.create({
        data: {
          name: r.name,
          email: r.email,
          phone: r.phone,
          block: r.block,
          flatNumber: r.flatNumber,
          residentType: "TENANT",
          isApproved: true,
          roles: { connect: { id: residentRole.id } },
        },
      });

      // Also update the SosAcceptance with the new residentId (if email matches)
      await prisma.sosAcceptance.updateMany({
        where: { email: r.email },
        data: { residentId: resident.id },
      });

      console.log(`✅ Added: ${r.name} (${r.email}) — Block ${r.block} / ${r.flatNumber}`);
      added++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`⚠️  Skipped: ${r.name} (${r.email}) — ${msg.includes("Unique") ? "email already exists" : msg.substring(0, 80)}`);
      skipped++;
    }
  }

  console.log(`\n✅ Added: ${added}  |  ⚠️  Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main();
