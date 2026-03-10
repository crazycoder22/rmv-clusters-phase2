"use client";

import { useSession } from "next-auth/react";
import {
  type UserRole,
  hasRole,
  hasExactRole,
  isAdmin,
  isSuperAdmin,
  isEventManager,
  isCommunityAdmin,
  canManageAnnouncements,
  canManageResidents,
  canManageVisitors,
  canAccessTasks,
} from "@/lib/roles";

export function useRole() {
  const { data: session, status } = useSession();
  const roles = (session?.user?.roles ?? []) as UserRole[];

  return {
    roles,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    hasRole: (requiredRole: UserRole) => hasRole(roles, requiredRole),
    hasExactRole: (role: UserRole) => hasExactRole(roles, role),
    isAdmin: () => isAdmin(roles),
    isSuperAdmin: () => isSuperAdmin(roles),
    isEventManager: () => isEventManager(roles),
    isCommunityAdmin: () => isCommunityAdmin(roles),
    canManageAnnouncements: () => canManageAnnouncements(roles),
    canManageResidents: () => canManageResidents(roles),
    canManageVisitors: () => canManageVisitors(roles),
    canAccessTasks: () => canAccessTasks(roles),
  };
}
