import { isAdmin, hasExactRole } from "@/lib/roles";

// Who can view the MyGate complaints mirror: admins + the facility manager
// (same gate as community issues — these are maintenance complaints).
export function canViewMygate(roles: string[] | null | undefined): boolean {
  return isAdmin(roles) || hasExactRole(roles, "FACILITY_MANAGER");
}
