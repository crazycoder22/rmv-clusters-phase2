"use client";

import { useSession } from "next-auth/react";
import { useCallback, useMemo } from "react";
import {
  type UserRole,
  hasRole as hasRoleFn,
  hasExactRole as hasExactRoleFn,
  isAdmin as isAdminFn,
  isSuperAdmin as isSuperAdminFn,
  isEventManager as isEventManagerFn,
  isCommunityAdmin as isCommunityAdminFn,
  canManageAnnouncements as canManageAnnouncementsFn,
  canManageResidents as canManageResidentsFn,
  canManageVisitors as canManageVisitorsFn,
  canAccessTasks as canAccessTasksFn,
  canManageNewsletters as canManageNewslettersFn,
} from "@/lib/roles";

export function useRole() {
  const { data: session, status } = useSession();
  const roles = useMemo(
    () => (session?.user?.roles ?? []) as UserRole[],
    [session?.user?.roles]
  );

  return {
    roles,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    hasRole: useCallback((requiredRole: UserRole) => hasRoleFn(roles, requiredRole), [roles]),
    hasExactRole: useCallback((role: UserRole) => hasExactRoleFn(roles, role), [roles]),
    isAdmin: useCallback(() => isAdminFn(roles), [roles]),
    isSuperAdmin: useCallback(() => isSuperAdminFn(roles), [roles]),
    isEventManager: useCallback(() => isEventManagerFn(roles), [roles]),
    isCommunityAdmin: useCallback(() => isCommunityAdminFn(roles), [roles]),
    canManageAnnouncements: useCallback(() => canManageAnnouncementsFn(roles), [roles]),
    canManageResidents: useCallback(() => canManageResidentsFn(roles), [roles]),
    canManageVisitors: useCallback(() => canManageVisitorsFn(roles), [roles]),
    canAccessTasks: useCallback(() => canAccessTasksFn(roles), [roles]),
    canManageNewsletters: useCallback(() => canManageNewslettersFn(roles), [roles]),
  };
}
