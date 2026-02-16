"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Phone,
  Mail,
  Car,
  Building,
} from "lucide-react";
import type { VisitorRecord } from "@/types";

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : status === "REJECTED"
      ? "bg-red-100 text-red-700"
      : "bg-yellow-100 text-yellow-700";

  return (
    <span
      className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${styles}`}
    >
      {status}
    </span>
  );
}

export default function VisitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [visitor, setVisitor] = useState<VisitorRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    async function fetchVisitor() {
      try {
        const res = await fetch(`/api/visitors/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setVisitor(data.visitor);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchVisitor();
  }, [id]);

  const role = session?.user?.role;
  const isSecurityOrAdmin =
    role === "ADMIN" || role === "SUPERADMIN" || role === "SECURITY";
  const canApprove =
    !isSecurityOrAdmin && visitor?.status === "PENDING";

  async function handleAction(newStatus: "APPROVED" | "REJECTED") {
    setActing(true);
    setActionError("");
    try {
      const res = await fetch(`/api/visitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setVisitor(data.visitor);
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to update");
      }
    } catch {
      setActionError("Failed to update visitor status");
    } finally {
      setActing(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-center text-gray-500">Loading...</p>
      </div>
    );
  }

  if (notFound || !visitor) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Visitor Not Found
        </h1>
        <p className="text-gray-600 mb-6">
          This visitor record may have been removed.
        </p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You do not have permission to view this visitor record.
        </p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-primary-700 font-medium mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="bg-white rounded-lg p-6 sm:p-8 shadow-sm border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Visitor Details
          </h1>
          <StatusBadge status={visitor.status} />
        </div>

        {/* Visitor info */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <User size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p className="text-sm font-medium text-gray-900">
                {visitor.name}
              </p>
            </div>
          </div>

          {visitor.phone && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Phone size={18} className="text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <a
                  href={`tel:${visitor.phone}`}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  {visitor.phone}
                </a>
              </div>
            </div>
          )}

          {visitor.email && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Mail size={18} className="text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900">
                  {visitor.email}
                </p>
              </div>
            </div>
          )}

          {visitor.vehicleNumber && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Car size={18} className="text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Vehicle Number</p>
                <p className="text-sm font-medium text-gray-900">
                  {visitor.vehicleNumber}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Building size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Visiting</p>
              <p className="text-sm font-medium text-gray-900">
                Block {visitor.visitingBlock}, Flat {visitor.visitingFlat}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Registered</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(visitor.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons for residents */}
        {canApprove && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-600 mb-4">
              This visitor is waiting for your approval to enter.
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleAction("APPROVED")}
                disabled={acting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                <CheckCircle size={18} />
                {acting ? "Processing..." : "Approve"}
              </button>
              <button
                onClick={() => handleAction("REJECTED")}
                disabled={acting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                <XCircle size={18} />
                {acting ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        )}

        {/* Status message for already processed */}
        {visitor.status === "APPROVED" && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={18} />
              <p className="text-sm font-medium">
                This visitor has been approved for entry.
              </p>
            </div>
          </div>
        )}
        {visitor.status === "REJECTED" && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle size={18} />
              <p className="text-sm font-medium">
                This visitor has been denied entry.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
