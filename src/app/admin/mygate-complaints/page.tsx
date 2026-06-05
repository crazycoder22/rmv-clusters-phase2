import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { canViewMygate } from "@/lib/mygate-auth";
import MygateComplaintsDashboard from "@/components/mygate/MygateComplaintsDashboard";

export const metadata = {
  title: "MyGate Complaints — Admin",
  description: "Imported MyGate Help Desk complaints with analytics",
};

export default async function AdminMygateComplaintsPage() {
  const session = await requireAuth();
  if (!canViewMygate(session.user.roles)) redirect("/");

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          MyGate Complaints
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Help Desk complaints imported from MyGate — a read-only snapshot for tracking and analytics.
        </p>
      </div>
      <MygateComplaintsDashboard />
    </main>
  );
}
