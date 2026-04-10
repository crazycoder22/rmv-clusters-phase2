import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/roles";
import VisitLogTable from "@/components/visits/VisitLogTable";

export const metadata = {
  title: "Visitor Entries",
  description: "Historical visitor entries at the RMV Clusters gate",
};

export default async function VisitsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  if (!session.user.isApproved) redirect("/pending-approval");
  const adminView = isAdmin(session.user.roles);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Visitor Entries
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {adminView
            ? "All visitor entries logged at the main gate, imported from MyGate."
            : "Visitors who came to your flat, imported from MyGate."}
        </p>
      </div>
      <VisitLogTable adminView={adminView} />
    </main>
  );
}
