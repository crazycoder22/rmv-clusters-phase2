export type UserRole = "RESIDENT" | "ADMIN" | "SUPERADMIN";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  RESIDENT: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

/** Check if a user has a specific role or higher */
export function hasRole(
  userRole: UserRole | string | null | undefined,
  requiredRole: UserRole
): boolean {
  if (!userRole) return false;
  const level = ROLE_HIERARCHY[userRole as UserRole];
  const required = ROLE_HIERARCHY[requiredRole];
  return level !== undefined && level >= required;
}

/** Check if user is an admin (ADMIN or SUPERADMIN) */
export function isAdmin(role: UserRole | string | null | undefined): boolean {
  return hasRole(role, "ADMIN");
}

/** Check if user is a superadmin */
export function isSuperAdmin(
  role: UserRole | string | null | undefined
): boolean {
  return role === "SUPERADMIN";
}

/** Get display name for role */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    RESIDENT: "Resident",
    ADMIN: "Administrator",
    SUPERADMIN: "Super Administrator",
  };
  return names[role];
}
