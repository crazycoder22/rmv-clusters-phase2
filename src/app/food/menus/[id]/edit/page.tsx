"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import MenuForm from "../../../MenuForm";

export default function EditMenuPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);
  return <MenuForm menuId={params?.id} />;
}
