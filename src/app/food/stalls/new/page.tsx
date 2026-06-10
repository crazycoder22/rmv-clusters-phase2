"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import MenuForm from "../../MenuForm";

// New Bazaar stall (MARKET kind). Lives under /food so Bazaar is one section.
export default function NewStallPage() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);
  return <MenuForm kind="MARKET" />;
}
