"use client";

import { useSession, signOut } from "next-auth/react";
import { Clock } from "lucide-react";

export default function PendingApprovalPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <Clock size={32} className="text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Registration Submitted
        </h1>
        <p className="text-gray-600 mb-2">
          Thank you{session?.user?.name ? `, ${session.user.name}` : ""}! Your
          registration has been received.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Your account is pending admin approval. You&apos;ll be able to access
          the community portal once an administrator approves your registration.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
