// Mobile-side role helpers — mirror the gates used by src/lib/roles.ts on
// the web. Keep these in sync when the server-side definitions change so
// the iOS / Android UI shows the same buttons as the web UI does.
//
// `roles` is the string[] coming off AuthUser (the JWT payload's roles).
// Comparisons are case-sensitive — matches the canonical names stored in
// the Role table: RESIDENT, ADMIN, SUPERADMIN, FACILITY_MANAGER, etc.

type Roles = string[] | null | undefined;

function has(roles: Roles, name: string): boolean {
  return Array.isArray(roles) && roles.includes(name);
}

/** Any admin: ADMIN or SUPERADMIN. */
export function isAdmin(roles: Roles): boolean {
  return has(roles, "ADMIN") || has(roles, "SUPERADMIN");
}

/** Super-admin specifically — used for the riskiest actions. */
export function isSuperAdmin(roles: Roles): boolean {
  return has(roles, "SUPERADMIN");
}

/**
 * Can issue vehicle stickers from the admin dashboard:
 * admins + the dedicated FACILITY_MANAGER role. Mirrors
 * `canIssueStickers` in src/lib/roles.ts.
 */
export function canIssueStickers(roles: Roles): boolean {
  return isAdmin(roles) || has(roles, "FACILITY_MANAGER");
}

/**
 * Higher gate than canIssueStickers — used for destructive actions like
 * deleting a sticker submission. Mirrors `canManageAnnouncements`.
 * Currently identical to isAdmin; kept as its own helper so the gate can
 * diverge later without changing call sites.
 */
export function canManageAnnouncements(roles: Roles): boolean {
  return isAdmin(roles);
}
