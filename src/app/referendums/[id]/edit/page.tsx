"use client";

import { useParams } from "next/navigation";
import ReferendumForm from "../../ReferendumForm";

export default function EditReferendumPage() {
  const params = useParams<{ id: string }>();
  return <ReferendumForm referendumId={params?.id ?? ""} />;
}
