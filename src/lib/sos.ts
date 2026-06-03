import { prisma } from "@/lib/prisma";

export const MAX_NOTE = 200;

// Is this resident an active SOS warrior? Derived server-side — the mobile
// auth token does NOT carry isSosWarrior.
export async function isWarrior(residentId: string): Promise<boolean> {
  const r = await prisma.resident.findUnique({
    where: { id: residentId },
    select: { isSosWarrior: true, isApproved: true },
  });
  return !!(r?.isSosWarrior && r?.isApproved);
}

// IDs of all approved SOS warriors — the push audience for a new alert.
export async function warriorIds(): Promise<string[]> {
  const warriors = await prisma.resident.findMany({
    where: { isApproved: true, isSosWarrior: true },
    select: { id: true },
  });
  return warriors.map((w) => w.id);
}
