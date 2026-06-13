import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyMobileJwt } from "@/lib/mobile-auth";

// How stale lastSeenAt must be before we write again — keeps usage tracking to
// at most one DB write per resident per window (no write storm on every call).
const SEEN_THROTTLE_MS = 15 * 60 * 1000;

// Fire-and-forget: stamp the resident's last activity + platform, throttled.
// Never blocks the request or throws.
function touchLastSeen(
  id: string,
  platform: string,
  prevSeenAt: Date | null,
  prevPlatform: string | null
): void {
  const stale = !prevSeenAt || Date.now() - prevSeenAt.getTime() > SEEN_THROTTLE_MS;
  if (!stale && prevPlatform === platform) return;
  void prisma.resident
    .update({ where: { id }, data: { lastSeenAt: new Date(), lastPlatform: platform } })
    .catch(() => {});
}

// "ios" | "android" from the app's X-Client-Platform header; "app" if a bearer
// token didn't send one; "web" for cookie sessions.
function bearerPlatform(request: Request): string {
  const p = (request.headers.get("x-client-platform") || "").toLowerCase();
  return p === "ios" || p === "android" ? p : "app";
}

export type AuthedResident = {
  id: string;
  email: string;
  name: string;
  phone: string;
  block: number;
  flatNumber: string;
  residentType: string;
  isApproved: boolean;
  isSeniorCitizen: boolean;
  dailyStepGoal: number;
  stepSource: string | null;
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
          isSeniorCitizen: true,
          dailyStepGoal: true,
          stepSource: true,
          deactivatedAt: true,
          lastSeenAt: true,
          lastPlatform: true,
          roles: { select: { name: true } },
        },
      });
      if (!resident) return null;
      if (resident.deactivatedAt) return null; // deactivated account → locked out
      touchLastSeen(resident.id, bearerPlatform(request), resident.lastSeenAt, resident.lastPlatform);
      return {
        id: resident.id,
        email: resident.email,
        name: resident.name,
        phone: resident.phone,
        block: resident.block,
        flatNumber: resident.flatNumber,
        residentType: resident.residentType,
        isApproved: resident.isApproved,
        isSeniorCitizen: resident.isSeniorCitizen,
        dailyStepGoal: resident.dailyStepGoal,
        stepSource: resident.stepSource,
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
      isSeniorCitizen: true,
      dailyStepGoal: true,
      stepSource: true,
      deactivatedAt: true,
      lastSeenAt: true,
      lastPlatform: true,
      roles: { select: { name: true } },
    },
  });
  if (!resident) return null;
  if (resident.deactivatedAt) return null; // deactivated account → locked out
  touchLastSeen(resident.id, "web", resident.lastSeenAt, resident.lastPlatform);
  return {
    id: resident.id,
    email: resident.email,
    name: resident.name,
    phone: resident.phone,
    block: resident.block,
    flatNumber: resident.flatNumber,
    residentType: resident.residentType,
    isApproved: resident.isApproved,
    isSeniorCitizen: resident.isSeniorCitizen,
    dailyStepGoal: resident.dailyStepGoal,
    stepSource: resident.stepSource,
    roles: resident.roles.map((r) => r.name),
  };
}
