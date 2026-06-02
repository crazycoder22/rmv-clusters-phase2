import { prisma } from "@/lib/prisma";

// Resolve my membership in a group. Returns null if the group doesn't exist
// or I'm not a member.
export async function myMembership(groupId: string, residentId: string) {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_residentId: { groupId, residentId } },
    select: { role: true },
  });
  return m; // { role } | null
}

export async function isOrganizer(groupId: string, residentId: string): Promise<boolean> {
  const m = await myMembership(groupId, residentId);
  return m?.role === "ORGANIZER";
}
