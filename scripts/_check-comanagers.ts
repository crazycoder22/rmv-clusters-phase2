// Rollback-safe e2e for Food/Bazaar co-managers. Runs inside a transaction
// that always throws at the end, so NOTHING is persisted to the DB.
import { prisma } from "../src/lib/prisma";
import { isMenuManager } from "../src/lib/food";

const ROLLBACK = "ROLLBACK_SENTINEL";

async function main() {
  const menu = await prisma.foodMenu.findFirst({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, title: true, chefId: true, kind: true },
  });
  if (!menu) throw new Error("No menu found to test against");

  // A resident who is NOT the owner.
  const other = await prisma.resident.findFirst({
    where: { isApproved: true, id: { not: menu.chefId } },
    select: { id: true, name: true },
  });
  if (!other) throw new Error("No other resident found");

  console.log(`Menu: "${menu.title}" (${menu.kind}) owned by ${menu.chefId}`);
  console.log(`Nominee: ${other.name} (${other.id})`);

  try {
    await prisma.$transaction(async (tx) => {
      // Before: not a manager.
      const before = await isMenuManager(tx, menu.id, other.id);
      console.log(`isMenuManager before nominate: ${before}  (expect false)`);

      // Nominate.
      await tx.foodMenuManager.create({
        data: { menuId: menu.id, residentId: other.id, addedById: menu.chefId },
      });

      // After: is a manager.
      const after = await isMenuManager(tx, menu.id, other.id);
      console.log(`isMenuManager after nominate:  ${after}  (expect true)`);

      // The "?mine=chef" OR query should now surface this menu for the nominee.
      const mine = await tx.foodMenu.findMany({
        where: {
          status: { not: "ARCHIVED" },
          OR: [{ chefId: other.id }, { managers: { some: { residentId: other.id } } }],
        },
        select: { id: true },
      });
      const surfaced = mine.some((m) => m.id === menu.id);
      console.log(`menu in nominee's "mine" list: ${surfaced}  (expect true)`);

      // coManaging flag derivation.
      console.log(`coManaging (chefId !== nominee): ${menu.chefId !== other.id}  (expect true)`);

      if (before !== false || after !== true || !surfaced) {
        throw new Error("ASSERTION FAILED");
      }
      console.log("\n✅ All assertions passed.");
      // Always roll back — leave the DB untouched.
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if (e instanceof Error && e.message === ROLLBACK) {
      console.log("↩️  Transaction rolled back — no rows persisted.");
    } else {
      throw e;
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
