import { redirect } from "next/navigation";

// Food Vendors now lives as a tab inside the Food & Bazaar hub.
export default function VendorsPage() {
  redirect("/food?tab=vendors");
}
