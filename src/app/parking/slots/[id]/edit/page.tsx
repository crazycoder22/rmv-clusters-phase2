"use client";

import { useParams } from "next/navigation";
import SlotForm from "../../../SlotForm";

export default function EditParkingSlotPage() {
  const params = useParams<{ id: string }>();
  return <SlotForm slotId={params?.id ?? ""} />;
}
