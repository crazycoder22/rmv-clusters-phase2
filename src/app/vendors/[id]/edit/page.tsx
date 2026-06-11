import VendorForm from "../../VendorForm";

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VendorForm vendorId={id} />;
}
