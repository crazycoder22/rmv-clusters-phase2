"use client";

import { useSession } from "next-auth/react";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import MenuForm from "../../MenuForm";

// New Bazaar stall (MARKET kind). Lives under /food so Bazaar is one section.
export default function NewStallPage() {
  const { status } = useSession();
  useRequireSignIn(status);
  return <MenuForm kind="MARKET" />;
}
