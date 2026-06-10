"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import MenuForm from "../../../food/MenuForm";

export default function NewStallPage() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);
  return <MenuForm kind="MARKET" />;
}
