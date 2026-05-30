import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyMobileJwt } from "@/lib/mobile-auth";

export type AuthedResident = {
  id: string;
  email: string;
  name: string;
  phone: string;
  block: number;
  flatNumber: string;
  residentType: string;
  isApproved: boolean;
  roles: string[];
};

/**
 * Resolves the authenticated resident from either:
 *   - A `Authorization: Bearer <mobile-jwt>` header (mobile app), or
 *   - A NextAuth session cookie (web app).
 *
 * Returns `null` on failure (no auth or not a resident). Callers decide how
 * to respond (401 vs 403 etc).
 */
export async function getAuthedResident(
  request: Request
): Promise<AuthedResident | null> {
  // Try Bearer JWT first (mobile).
  const authz = request.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    const token = authz.slice("Bearer ".length).trim();
    try {
      const payload = await verifyMobileJwt(token);
      const resident = await prisma.resident.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          block: true,
          flatNumber: true,
          residentType: true,
          isApproved: true,
          roles: { select: { name: true } },
        },
      });
      if (!resident) return null;
      return {
        id: resident.id,
        email: resident.email,
        name: resident.name,
        phone: resident.phone,
        block: resident.block,
        flatNumber: resident.flatNumber,
        residentType: resident.residentType,
        isApproved: resident.isApproved,
        roles: resident.roles.map((r) => r.name),
      };
    } catch {
      return null;
    }
  }

  // Fall back to NextAuth session cookie.
  const session = await auth();
  if (!session?.user?.email) return null;
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      block: true,
      flatNumber: true,
      residentType: true,
      isApproved: true,
      roles: { select: { name: true } },
    },
  });
  if (!resident) return null;
  return {
    id: resident.id,
    email: resident.email,
    name: resident.name,
    phone: resident.phone,
    block: resident.block,
    flatNumber: resident.flatNumber,
    residentType: resident.residentType,
    isApproved: resident.isApproved,
    roles: resident.roles.map((r) => r.name),
  };
}
