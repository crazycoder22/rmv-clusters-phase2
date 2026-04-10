import Link from "next/link";
import { requireAuth } from "@/lib/require-auth";
import { isAdmin } from "@/lib/roles";
import VisitLogTable from "@/components/visits/VisitLogTable";

export const metadata = {
  title: "Your Visitors",
  description: "Visitors who came to your flat at RMV Clusters",
};

export default async function VisitsPage() {
  const session = await requireAuth();
  const adminUser = isAdmin(session.user.roles);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Your Visitors
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Visitors who came to your flat, imported from MyGate.
          </p>
        </div>
        {adminUser && (
          <Link
            href="/admin/visits"
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            Admin view →
          </Link>
        )}
      </div>
      <VisitLogTable adminView={false} />
    </main>
  );
}
