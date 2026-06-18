"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import MenuForm from "../../../MenuForm";

export default function EditMenuPage() {
  const { status } = useSession();
  const params = useParams<{ id: string }>();
  useRequireSignIn(status);
  return <MenuForm menuId={params?.id} />;
}
