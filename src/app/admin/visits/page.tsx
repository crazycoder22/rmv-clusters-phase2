import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/require-auth";
import { isAdmin } from "@/lib/roles";
import VisitLogTable from "@/components/visits/VisitLogTable";

export const metadata = {
  title: "Visitor Entries — Admin",
  description: "Community-wide visitor entry analytics",
};

export default async function AdminVisitsPage() {
  const session = await requireAuth();
  if (!isAdmin(session.user.roles)) redirect("/visits");

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Visitor Entries — Admin
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Community-wide visitor entries with stats and filters. For your own
            flat&apos;s visits, see{" "}
            <Link
              href="/visits"
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              Your Visitors
            </Link>
            .
          </p>
        </div>
      </div>
      <VisitLogTable adminView={true} />
    </main>
  );
}
