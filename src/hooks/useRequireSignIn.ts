"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { signIn } from "next-auth/react";

/**
 * Redirect unauthenticated users to Google sign-in, returning to the current
 * page after login. There is no `/login` page — `signIn("google", …)` is the
 * app's sign-in entry point. Pass the `status` from `useSession()`.
 *
 * Replaces the old (broken) `router.push("/login")` pattern, which navigated
 * to a non-existent route.
 */
export function useRequireSignIn(status: string) {
  const pathname = usePathname();
  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google", { callbackUrl: pathname || "/" });
    }
  }, [status, pathname]);
}
