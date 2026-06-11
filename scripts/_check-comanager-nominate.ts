// Rollback-safe e2e for the two new behaviors:
//   (1) create a listing WITH co-managers in one go (createMany path)
//   (2) a co-manager can nominate ANOTHER co-manager (POST gate logic)
// Everything runs in a transaction that throws at the end → nothing persists.
import { prisma } from "../src/lib/prisma";
import { isMenuManager } from "../src/lib/food";

const ROLLBACK = "ROLLBACK_SENTINEL";

// Mirrors the POST /managers gate: owner OR an existing co-manager may add.
async function canNominate(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], menuId: string, chefId: string, actorId: string) {
  return actorId === chefId || (await isMenuManager(tx, menuId, actorId));
}

async function main() {
  const owner = await prisma.resident.findFirst({ where: { isApproved: true }, select: { id: true, name: true } });
  const others = await prisma.resident.findMany({
    where: { isApproved: true, id: { not: owner!.id } },
    select: { id: true, name: true },
    take: 2,
  });
  if (!owner || others.length < 2) throw new Error("Need 3 approved residents");
  const [coA, coB] = others;
  console.log(`Owner:   ${owner.name}`);
  console.log(`Co-mgr A: ${coA.name}`);
  console.log(`Co-mgr B: ${coB.name}`);

  try {
    await prisma.$transaction(async (tx) => {
      // (1) Create a menu WITH co-manager A up-front (mimics POST create + createMany).
      const menu = await tx.foodMenu.create({
        data: { chefId: owner.id, kind: "KITCHEN", title: "TEST co-manager menu", date: new Date() },
        select: { id: true },
      });
      await tx.foodMenuManager.createMany({
        data: [{ menuId: menu.id, residentId: coA.id, addedById: owner.id }],
        skipDuplicates: true,
      });
      const aIsMgr = await isMenuManager(tx, menu.id, coA.id);
      console.log(`\n(1) Create-with-co-manager → A is manager: ${aIsMgr}  (expect true)`);

      // (2a) Co-manager A is allowed to nominate (gate).
      const aCanNominate = await canNominate(tx, menu.id, owner.id, coA.id);
      console.log(`(2) Co-manager A may nominate others: ${aCanNominate}  (expect true)`);

      // (2b) A random non-manager is NOT allowed.
      const bCanNominateBefore = await canNominate(tx, menu.id, owner.id, coB.id);
      console.log(`    Non-manager B may nominate:        ${bCanNominateBefore}  (expect false)`);

      // A nominates B → B becomes a manager.
      await tx.foodMenuManager.create({ data: { menuId: menu.id, residentId: coB.id, addedById: coA.id } });
      const bIsMgr = await isMenuManager(tx, menu.id, coB.id);
      console.log(`    A nominated B → B is manager:      ${bIsMgr}  (expect true)`);

      if (!aIsMgr || !aCanNominate || bCanNominateBefore || !bIsMgr) throw new Error("ASSERTION FAILED");
      console.log("\n✅ All assertions passed.");
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if (e instanceof Error && e.message === ROLLBACK) {
      console.log("↩️  Rolled back — no rows persisted.");
    } else {
      throw e;
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
