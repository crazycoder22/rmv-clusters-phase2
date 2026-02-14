"use client";

import { useSession } from "next-auth/react";
import { type UserRole, hasRole, isAdmin, isSuperAdmin } from "@/lib/roles";

export function useRole() {
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? null) as UserRole | null;

  return {
    role,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    hasRole: (requiredRole: UserRole) => hasRole(role, requiredRole),
    isAdmin: () => isAdmin(role),
    isSuperAdmin: () => isSuperAdmin(role),
  };
}
