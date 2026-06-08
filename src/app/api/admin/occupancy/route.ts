import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";

// Occupancy classification (source of truth):
//   1. Bank-owned flat            -> tenant-occupied
//   2. Has a registered tenant    -> tenant-occupied
//   3. Vacant (no resident)       -> tenant-occupied
//   4. Otherwise (owner present)  -> owner-occupied
const TENANT_TYPES = ["TENANT", "TENANT_FAMILY", "MULTI_TENANT"];
const OWNER_TYPES = ["OWNER", "OWNER_FAMILY"];
const norm = (s: string) => s.trim().replace(/\.0$/, "").replace(/\s+/g, "");
const key = (b: number, f: string) => `${b}|${norm(f)}`;

type Bucket = {
  block: number;
  total: number;
  ownerOccupied: number;
  bank: number;
  tenantRegistered: number;
  vacant: number;
};

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(resident.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [flats, residents] = await Promise.all([
    prisma.flat.findMany({ select: { block: true, flatNumber: true, isBankOwned: true } }),
    prisma.resident.findMany({ select: { block: true, flatNumber: true, residentType: true } }),
  ]);

  const byFlat = new Map<string, Set<string>>();
  for (const r of residents) {
    if (r.flatNumber.trim().toUpperCase() === "OFFICE") continue;
    const k = key(r.block, r.flatNumber);
    if (!byFlat.has(k)) byFlat.set(k, new Set());
    byFlat.get(k)!.add(r.residentType);
  }

  const blocks = new Map<number, Bucket>();
  const bucket = (b: number): Bucket => {
    if (!blocks.has(b))
      blocks.set(b, { block: b, total: 0, ownerOccupied: 0, bank: 0, tenantRegistered: 0, vacant: 0 });
    return blocks.get(b)!;
  };

  for (const f of flats) {
    const bk = bucket(f.block);
    bk.total++;
    if (f.isBankOwned) {
      bk.bank++;
      continue;
    }
    const types = byFlat.get(key(f.block, f.flatNumber));
    if (types && [...types].some((t) => TENANT_TYPES.includes(t))) {
      bk.tenantRegistered++;
      continue;
    }
    if (!types || types.size === 0) {
      bk.vacant++;
      continue;
    }
    if ([...types].some((t) => OWNER_TYPES.includes(t))) {
      bk.ownerOccupied++;
    } else {
      bk.vacant++;
    }
  }

  const byBlock = [...blocks.values()].sort((a, b) => a.block - b.block);
  const totals = byBlock.reduce(
    (acc, b) => ({
      total: acc.total + b.total,
      ownerOccupied: acc.ownerOccupied + b.ownerOccupied,
      bank: acc.bank + b.bank,
      tenantRegistered: acc.tenantRegistered + b.tenantRegistered,
      vacant: acc.vacant + b.vacant,
    }),
    { total: 0, ownerOccupied: 0, bank: 0, tenantRegistered: 0, vacant: 0 }
  );
  const tenantOccupied = totals.bank + totals.tenantRegistered + totals.vacant;

  return NextResponse.json({
    totals: { ...totals, tenantOccupied },
    byBlock: byBlock.map((b) => ({
      ...b,
      tenantOccupied: b.bank + b.tenantRegistered + b.vacant,
    })),
  });
}
