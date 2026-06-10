import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Read-only inspector for the food-ordering feature.
// Usage: npx tsx scripts/_check-food.ts
async function main() {
  const menus = await prisma.foodMenu.findMany({
    include: {
      chef: { select: { name: true, block: true, flatNumber: true } },
      items: { select: { name: true, price: true, soldOut: true } },
      orders: {
        include: {
          buyer: { select: { name: true } },
          items: { select: { nameSnapshot: true, qty: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n=== Food menus: ${menus.length} ===\n`);
  if (menus.length === 0) {
    console.log("(no menus yet)");
    await prisma.$disconnect();
    return;
  }

  for (const m of menus) {
    console.log(`${m.title}  [${m.status}]`);
    console.log(`   chef:   ${m.chef.name} (B${m.chef.block} ${m.chef.flatNumber})`);
    console.log(`   dishes: ${m.items.map((i) => `${i.name} ₹${i.price}${i.soldOut ? " (SOLD OUT)" : ""}`).join(", ") || "—"}`);
    console.log(`   orders: ${m.orders.length}`);
    for (const o of m.orders) {
      const pay = o.chefPaid ? "✅ received" : o.buyerPaid ? "🟡 claimed" : "⬜ unpaid";
      const lines = o.items.map((li) => `${li.qty}× ${li.nameSnapshot}`).join(", ");
      const who = o.buyer?.name ?? `${o.manualBuyerName ?? "Offline"} (offline)`;
      console.log(`     - ${who}: ₹${o.totalAmount} [${o.status}] ${pay} — ${lines}`);
    }
    console.log("");
  }

  const follows = await prisma.chefFollow.count();
  console.log(`Chef follows: ${follows}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
