import { prisma } from "../src/lib/prisma";

async function main() {
  const prashanths = await prisma.resident.findMany({
    where: { name: { contains: "Prashanth", mode: "insensitive" } },
    select: { id: true, name: true, block: true, flatNumber: true },
  });
  console.log("Residents named Prashanth:");
  for (const p of prashanths) console.log(`  ${p.name} · B${p.block}-${p.flatNumber} · ${p.id}`);

  const ids = prashanths.map((p) => p.id);
  const menus = await prisma.foodMenu.findMany({
    where: { chefId: { in: ids }, kind: "KITCHEN", status: { not: "ARCHIVED" } },
    select: {
      id: true, title: true, status: true, chefId: true,
      _count: { select: { orders: true } },
      managers: { include: { resident: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\nKITCHEN menus owned by Prashanth (${menus.length}):`);
  for (const m of menus) {
    const owner = prashanths.find((p) => p.id === m.chefId)?.name ?? m.chefId;
    const mgrs = m.managers.map((x) => x.resident.name).join(", ") || "none";
    console.log(`  "${m.title}" [${m.status}] orders=${m._count.orders} owner=${owner}\n    id=${m.id}\n    co-managers: ${mgrs}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
