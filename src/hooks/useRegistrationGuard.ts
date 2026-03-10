"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function useRegistrationGuard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Redirect unregistered users to registration form
    if (
      status === "authenticated" &&
      session?.user &&
      !session.user.isRegistered &&
      pathname !== "/register"
    ) {
      router.push("/register");
    }

    // Redirect registered but unapproved users to pending page
    if (
      status === "authenticated" &&
      session?.user?.isRegistered &&
      !session.user.isApproved &&
      pathname !== "/pending-approval"
    ) {
      router.push("/pending-approval");
    }

    // Redirect approved users from home to their landing page
    if (
      status === "authenticated" &&
      session?.user?.isRegistered &&
      session?.user?.isApproved &&
      pathname === "/"
    ) {
      const roles = session.user.roles ?? [];
      // If SECURITY is their only role, send to visitors page
      if (roles.length === 1 && roles[0] === "SECURITY") {
        router.push("/visitors");
      } else {
        router.push("/dashboard");
      }
    }
  }, [status, session, pathname, router]);
}
