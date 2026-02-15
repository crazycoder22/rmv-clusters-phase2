"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRole } from "@/hooks/useRole";
import Link from "next/link";
import clsx from "clsx";
import type { MenuItemType } from "@/types";

interface RsvpResident {
  id: string;
  name: string;
  email: string;
  block: number;
  flatNumber: string;
}

interface RsvpItemData {
  id: string;
  menuItemId: string;
  menuItem: MenuItemType;
  plates: number;
}

interface RsvpData {
  id: string;
  resident: RsvpResident;
  items: RsvpItemData[];
  paid: boolean;
  notes: string | null;
  createdAt: string;
}

interface Summary {
  totalRsvps: number;
  totalPlates: number;
  totalAmount: number;
  paidCount: number;
  unpaidCount: number;
  itemTotals: { name: string; plates: number; amount: number }[];
}

export default function AdminRsvpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, isAdmin, isSuperAdmin, isLoading: roleLoading } = useRole();
  const [rsvps, setRsvps] = useState<RsvpData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [mealType, setMealType] = useState("");
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchRsvps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/rsvps`);
      if (res.ok) {
        const data = await res.json();
        setRsvps(data.rsvps);
        setSummary(data.summary);
        setEventTitle(data.announcement.title);
        setMealType(data.eventConfig.mealType);
        setRsvpDeadline(data.eventConfig.rsvpDeadline);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (role === "ADMIN" || role === "SUPERADMIN") {
      fetchRsvps();
    }
  }, [role, fetchRsvps]);

  const togglePaid = async (rsvpId: string, currentPaid: boolean) => {
    setTogglingId(rsvpId);
    try {
      const res = await fetch(`/api/admin/events/${id}/rsvps/${rsvpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !currentPaid }),
      });
      if (res.ok) {
        setRsvps((prev) =>
          prev.map((r) => (r.id === rsvpId ? { ...r, paid: !currentPaid } : r))
        );
        // Update summary counts
        if (summary) {
          setSummary({
            ...summary,
            paidCount: currentPaid ? summary.paidCount - 1 : summary.paidCount + 1,
            unpaidCount: currentPaid ? summary.unpaidCount + 1 : summary.unpaidCount - 1,
          });
        }
      }
    } catch {
      // silently fail
    } finally {
      setTogglingId(null);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAdmin() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-500">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <Link
        href="/admin"
        className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-6 inline-block"
      >
        &larr; Back to Admin Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-primary-800 mb-1">
        RSVP Tracking
      </h1>
      <p className="text-gray-500 mb-2">{eventTitle}</p>
      {mealType && (
        <div className="flex items-center gap-3 text-sm text-gray-500 mb-6">
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 capitalize">
            {mealType}
          </span>
          {rsvpDeadline && (
            <span>
              Deadline:{" "}
              {new Date(rsvpDeadline).toLocaleString("en-IN", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading RSVPs...</p>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-primary-700">{summary.totalRsvps}</p>
                <p className="text-xs text-gray-500 mt-1">Total RSVPs</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-gray-800">{summary.totalPlates}</p>
                <p className="text-xs text-gray-500 mt-1">Total Plates</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-green-700">₹{summary.totalAmount.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Total Amount</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {summary.paidCount}
                  <span className="text-gray-400 text-lg"> / {summary.totalRsvps}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">Paid</p>
              </div>
            </div>
          )}

          {/* Per-item breakdown */}
          {summary && summary.itemTotals.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Item Breakdown</h3>
              <div className="space-y-2">
                {summary.itemTotals.map((item) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.name}</span>
                    <span className="text-gray-800">
                      {item.plates} plates &middot; ₹{item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RSVPs table */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">All Responses</h2>
            <button
              onClick={fetchRsvps}
              disabled={loading}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {rsvps.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No RSVPs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="pb-3 pr-4 font-medium">Resident</th>
                    <th className="pb-3 pr-4 font-medium">Block / Flat</th>
                    <th className="pb-3 pr-4 font-medium">Items</th>
                    <th className="pb-3 pr-4 font-medium">Total</th>
                    <th className="pb-3 pr-4 font-medium">Notes</th>
                    <th className="pb-3 font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rsvps.map((rsvp) => {
                    const rsvpTotal = rsvp.items.reduce(
                      (sum, item) => sum + item.plates * item.menuItem.pricePerPlate,
                      0
                    );
                    return (
                      <tr
                        key={rsvp.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900">{rsvp.resident.name}</p>
                          <p className="text-xs text-gray-400">{rsvp.resident.email}</p>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          B{rsvp.resident.block} - {rsvp.resident.flatNumber}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {rsvp.items.map((item) => (
                            <div key={item.id} className="text-xs">
                              {item.menuItem.name} &times; {item.plates}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 pr-4 font-medium text-gray-800">
                          ₹{rsvpTotal.toFixed(2)}
                        </td>
                        <td className="py-3 pr-4 text-gray-500 text-xs max-w-[120px] truncate">
                          {rsvp.notes || "—"}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => togglePaid(rsvp.id, rsvp.paid)}
                            disabled={togglingId === rsvp.id}
                            className={clsx(
                              "inline-block px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer transition-colors disabled:opacity-50",
                              rsvp.paid
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-red-100 text-red-600 hover:bg-red-200"
                            )}
                          >
                            {rsvp.paid ? "Paid" : "Unpaid"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
