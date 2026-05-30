import { prisma } from "@/lib/prisma";
import { OWNER_TYPES, type ReferendumEligibilityValue } from "@/lib/referendums";

/**
 * Count distinct flats (block + flatNumber) among approved residents who are
 * eligible for a referendum of the given eligibility. Used for turnout %.
 * Server-only (imports prisma) — keep out of the pure `referendums.ts` lib.
 */
export async function countEligibleFlats(
  eligibility: ReferendumEligibilityValue
): Promise<number> {
  const groups = await prisma.resident.groupBy({
    by: ["block", "flatNumber"],
    where: {
      isApproved: true,
      ...(eligibility === "OWNERS_ONLY" ? { residentType: { in: [...OWNER_TYPES] } } : {}),
    },
  });
  return groups.length;
}
