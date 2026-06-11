// Rollback-safe e2e for Food Vendors. Creates a vendor (the Sona sample) +
// items inside a transaction that always throws → nothing persists.
import { prisma } from "../src/lib/prisma";
import { buildVendorShareText, waOrderLink } from "../src/lib/vendors";

const ROLLBACK = "ROLLBACK_SENTINEL";

async function main() {
  const adder = await prisma.resident.findFirst({ where: { isApproved: true }, select: { id: true, name: true } });
  if (!adder) throw new Error("No approved resident");

  const items = [
    { name: "Moode", price: 60, unit: "piece", section: "Veg", note: null, sortOrder: 0 },
    { name: "Pathrode", price: 60, unit: "piece", section: "Veg", note: null, sortOrder: 1 },
    { name: "Tondekai cashew palya", price: 450, unit: "kg", section: "Veg", note: null, sortOrder: 2 },
    { name: "Chicken ghee roast", price: 1200, unit: "kg", section: "Non-veg", note: null, sortOrder: 3 },
    { name: "Prawns", price: 1500, unit: "kg", section: "Non-veg", note: "50 to 60 pieces", sortOrder: 4 },
  ];

  try {
    await prisma.$transaction(async (tx) => {
      const v = await tx.foodVendor.create({
        data: {
          name: "Sona's Coastal Kitchen",
          phone: "9611053515",
          deliveryInfo: "Delivery 10am–1pm",
          notes: "Veg items sold by weight, min ½ kg. Non-veg net weight, min ½ kg.",
          forDate: new Date("2026-06-13T00:00:00+05:30"),
          addedById: adder.id,
          items: { create: items },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });

      // List-shape derivations.
      const sections = [...new Set(v.items.map((i) => i.section).filter(Boolean) as string[])];
      const minPrice = Math.min(...v.items.map((i) => i.price));
      console.log(`Created "${v.name}" — ${v.items.length} items · from ₹${minPrice} · sections: ${sections.join(", ")}`);

      // Share text + order link.
      const link = waOrderLink(v.phone, v.name);
      const text = buildVendorShareText({ ...v, items: v.items });
      console.log("\n--- waOrderLink ---\n" + link);
      console.log("\n--- buildVendorShareText ---\n" + text);

      const okLink = !!link && link.startsWith("https://wa.me/919611053515?text=");
      const okItems = v.items.length === 5;
      const okSections = sections.length === 2;
      const okShareHasPrice = text.includes("₹1200/kg") && text.includes("₹60/piece");
      console.log("\nasserts:", { okLink, okItems, okSections, okShareHasPrice });
      if (!okLink || !okItems || !okSections || !okShareHasPrice) throw new Error("ASSERTION FAILED");
      console.log("✅ All assertions passed.");
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if (e instanceof Error && e.message === ROLLBACK) console.log("↩️  Rolled back — no rows persisted.");
    else throw e;
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
