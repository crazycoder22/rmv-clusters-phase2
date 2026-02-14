"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function useRegistrationGuard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (
      status === "authenticated" &&
      session?.user &&
      !session.user.isRegistered &&
      pathname !== "/register"
    ) {
      router.push("/register");
    }
  }, [status, session, pathname, router]);
}
