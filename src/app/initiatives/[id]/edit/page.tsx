"use client";

import { useParams } from "next/navigation";
import InitiativeForm from "../../InitiativeForm";

export default function EditInitiativePage() {
  const params = useParams<{ id: string }>();
  return <InitiativeForm initiativeId={params?.id ?? ""} />;
}
