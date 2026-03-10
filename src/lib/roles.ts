export type UserRole =
  | "RESIDENT"
  | "ADMIN"
  | "SUPERADMIN"
  | "SECURITY"
  | "EVENT_MANAGER"
  | "FACILITY_MANAGER"
  | "COMMUNITY_ADMIN";

/** Non-RESIDENT roles assignable via the admin UI */
export const ASSIGNABLE_ROLES: UserRole[] = [
  "ADMIN",
  "COMMUNITY_ADMIN",
  "EVENT_MANAGER",
  "SECURITY",
  "FACILITY_MANAGER",
];

const ROLE_HIERARCHY: Record<UserRole, number> = {
  RESIDENT: 1,
  SECURITY: 1,
  EVENT_MANAGER: 1,
  FACILITY_MANAGER: 1,
  COMMUNITY_ADMIN: 2,
  ADMIN: 2,
  SUPERADMIN: 3,
};

/** Check if user has at least one role at or above the required level */
export function hasRole(
  userRoles: UserRole[] | string[] | null | undefined,
  requiredRole: UserRole
): boolean {
  const required = ROLE_HIERARCHY[requiredRole];
  if (!userRoles || userRoles.length === 0) {
    // Implicit RESIDENT
    return ROLE_HIERARCHY["RESIDENT"] >= required;
  }
  return userRoles.some((r) => {
    const level = ROLE_HIERARCHY[r as UserRole];
    return level !== undefined && level >= required;
  });
}

/** Check if user has a specific role (exact match) */
export function hasExactRole(
  userRoles: UserRole[] | string[] | null | undefined,
  role: UserRole
): boolean {
  if (role === "RESIDENT") return true; // Everyone is implicitly a resident
  if (!userRoles) return false;
  return userRoles.includes(role);
}

/** Check if user is an admin (ADMIN, SUPERADMIN, or COMMUNITY_ADMIN) */
export function isAdmin(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return hasRole(roles, "ADMIN");
}

/** Check if user is a superadmin */
export function isSuperAdmin(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return hasExactRole(roles, "SUPERADMIN");
}

/** Check if user is a security manager */
export function isSecurity(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return hasExactRole(roles, "SECURITY");
}

/** Check if user is an event manager */
export function isEventManager(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return hasExactRole(roles, "EVENT_MANAGER");
}

/** Check if user is a community admin */
export function isCommunityAdmin(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return hasExactRole(roles, "COMMUNITY_ADMIN");
}

/** Check if user can manage announcements/events (ADMIN, SUPERADMIN, COMMUNITY_ADMIN, or EVENT_MANAGER) */
export function canManageAnnouncements(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return isAdmin(roles) || isEventManager(roles);
}

/** Check if user can manage residents (approve, add) */
export function canManageResidents(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return isAdmin(roles);
}

/** Check if user can manage visitors (ADMIN, SUPERADMIN, COMMUNITY_ADMIN, or SECURITY) */
export function canManageVisitors(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return isAdmin(roles) || isSecurity(roles);
}

/** Check if user can access tasks */
export function canAccessTasks(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  return isAdmin(roles) || hasExactRole(roles, "FACILITY_MANAGER");
}

/** Get display name for a role */
export function getRoleDisplayName(role: UserRole | string): string {
  const names: Record<string, string> = {
    RESIDENT: "Resident",
    ADMIN: "Administrator",
    SUPERADMIN: "Super Administrator",
    SECURITY: "Security Manager",
    EVENT_MANAGER: "Event Manager",
    FACILITY_MANAGER: "Facility Manager",
    COMMUNITY_ADMIN: "Community Admin",
  };
  return names[role] ?? role;
}

/** Get badge color classes for a role */
export function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    SUPERADMIN: "bg-purple-100 text-purple-700",
    ADMIN: "bg-green-100 text-green-700",
    COMMUNITY_ADMIN: "bg-indigo-100 text-indigo-700",
    EVENT_MANAGER: "bg-teal-100 text-teal-700",
    FACILITY_MANAGER: "bg-orange-100 text-orange-700",
    SECURITY: "bg-blue-100 text-blue-700",
    RESIDENT: "bg-gray-100 text-gray-700",
  };
  return colors[role] ?? "bg-gray-100 text-gray-700";
}
