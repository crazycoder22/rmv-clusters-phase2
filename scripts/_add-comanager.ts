import { prisma } from "../src/lib/prisma";

const MENU_ID = "cmq6wuoc9000004l8uzaqe2cq"; // Payaniga Kitchen
const OWNER_ID = "cmmvt9lz5000tkl0xv1vj75gg"; // Prashanth V (nominator)

async function main() {
  const me = await prisma.resident.findFirst({
    where: { name: { contains: "Lakshman", mode: "insensitive" } },
    select: { id: true, name: true, block: true, flatNumber: true, isApproved: true },
  });
  if (!me) throw new Error("Lakshman not found");
  console.log(`Nominee: ${me.name} · B${me.block}-${me.flatNumber} · ${me.id} · approved=${me.isApproved}`);

  if (me.id === OWNER_ID) throw new Error("Nominee is the owner");

  const row = await prisma.foodMenuManager.upsert({
    where: { menuId_residentId: { menuId: MENU_ID, residentId: me.id } },
    update: {},
    create: { menuId: MENU_ID, residentId: me.id, addedById: OWNER_ID },
    select: { id: true, createdAt: true },
  });
  console.log(`✅ Co-manager row: ${row.id} (created ${row.createdAt.toISOString()})`);

  const managers = await prisma.foodMenuManager.findMany({
    where: { menuId: MENU_ID },
    include: { resident: { select: { name: true, block: true, flatNumber: true } } },
  });
  console.log("\nPayaniga Kitchen co-managers now:");
  for (const m of managers) console.log(`  ${m.resident.name} · B${m.resident.block}-${m.resident.flatNumber}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
