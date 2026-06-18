"use client";

import { useSession } from "next-auth/react";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import MenuForm from "../../MenuForm";

export default function NewMenuPage() {
  const { status } = useSession();
  useRequireSignIn(status);
  return <MenuForm />;
}
