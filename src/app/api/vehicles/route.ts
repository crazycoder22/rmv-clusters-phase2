import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/vehicles → vehicles for the logged-in resident's flat
// ?all=true (admin only) → all vehicles across the society
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const showAll = url.searchParams.get("all") === "true";

  // Admin: return all vehicles grouped by flat
  if (showAll && me.roles.includes("ADMIN")) {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: [{ block: "asc" }, { flatNumber: "asc" }, { vehicleType: "asc" }],
    });
    return NextResponse.json({ vehicles });
  }

  // Resident: return vehicles for their flat
  const vehicles = await prisma.vehicle.findMany({
    where: { block: me.block, flatNumber: me.flatNumber },
    orderBy: { vehicleType: "asc" },
  });

  // Also get summary stats for the society
  const [totalVehicles, totalCars, totalTwoWheelers, totalFlatsWithVehicles] =
    await Promise.all([
      prisma.vehicle.count(),
      prisma.vehicle.count({ where: { vehicleType: "Car" } }),
      prisma.vehicle.count({ where: { vehicleType: "Two Wheeler" } }),
      prisma.vehicle
        .findMany({
          select: { block: true, flatNumber: true },
          distinct: ["block", "flatNumber"],
        })
        .then((rows) => rows.length),
    ]);

  return NextResponse.json({
    vehicles: vehicles.map((v) => ({
      id: v.id,
      vehicleNumber: v.vehicleNumber,
      vehicleType: v.vehicleType,
      isEV: v.isEV,
      parkingName: v.parkingName,
    })),
    flat: {
      block: me.block,
      flatNumber: me.flatNumber,
    },
    stats: {
      totalVehicles,
      totalCars,
      totalTwoWheelers,
      totalFlatsWithVehicles,
    },
  });
}
