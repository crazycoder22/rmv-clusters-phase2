"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRole } from "@/hooks/useRole";
import Link from "next/link";

interface SportItemData {
  id: string;
  name: string;
  sortOrder: number;
}

interface ParticipantSportData {
  id: string;
  sportItemId: string;
  sportItem: SportItemData;
}

interface ParticipantData {
  id: string;
  name: string;
  ageCategory: string;
  sports: ParticipantSportData[];
}

interface RegistrationData {
  id: string;
  resident: {
    id: string;
    name: string;
    email: string;
    block: number;
    flatNumber: string;
  };
  participants: ParticipantData[];
  notes: string | null;
  createdAt: string;
}

interface Summary {
  totalRegistrations: number;
  totalParticipants: number;
  sportCounts: { name: string; count: number }[];
  ageCounts: { kid: number; teen: number; adult: number };
}

const ageCategoryLabels: Record<string, string> = {
  kid: "Kid",
  teen: "Teen",
  adult: "Adult",
};

export default function AdminSportsRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { role, isAdmin, isSuperAdmin, isLoading: roleLoading } = useRole();
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/sports-registrations`);
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.sportsConfig.registrations);
        setSummary(data.summary);
        setEventTitle(data.announcement.title);
        setDeadline(data.sportsConfig.registrationDeadline);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (role === "ADMIN" || role === "SUPERADMIN") {
      fetchData();
    }
  }, [role, fetchData]);

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
          <p className="text-gray-500">
            You do not have permission to access this page.
          </p>
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
        Sports Registrations
      </h1>
      <p className="text-gray-500 mb-2">{eventTitle}</p>
      {deadline && (
        <div className="flex items-center gap-3 text-sm text-gray-500 mb-6">
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
            Sports Event
          </span>
          <span>
            Deadline:{" "}
            {new Date(deadline).toLocaleString("en-IN", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading registrations...</p>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-orange-700">
                  {summary.totalRegistrations}
                </p>
                <p className="text-xs text-gray-500 mt-1">Families Registered</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {summary.totalParticipants}
                </p>
                <p className="text-xs text-gray-500 mt-1">Total Participants</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-blue-700">
                  {summary.ageCounts.adult}
                </p>
                <p className="text-xs text-gray-500 mt-1">Adults</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {summary.ageCounts.kid + summary.ageCounts.teen}
                </p>
                <p className="text-xs text-gray-500 mt-1">Kids &amp; Teens</p>
              </div>
            </div>
          )}

          {/* Per-sport breakdown */}
          {summary && summary.sportCounts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Sport-wise Participants
              </h3>
              <div className="space-y-2">
                {summary.sportCounts.map((sport) => (
                  <div key={sport.name} className="flex justify-between text-sm">
                    <span className="text-gray-600">{sport.name}</span>
                    <span className="font-medium text-gray-800">
                      {sport.count} participant{sport.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Age category breakdown */}
          {summary && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Age-wise Breakdown
              </h3>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Kids: </span>
                  <span className="font-medium text-gray-800">
                    {summary.ageCounts.kid}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Teens: </span>
                  <span className="font-medium text-gray-800">
                    {summary.ageCounts.teen}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Adults: </span>
                  <span className="font-medium text-gray-800">
                    {summary.ageCounts.adult}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Registrations table */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              All Registrations
            </h2>
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {registrations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No registrations yet.
            </p>
          ) : (
            <div className="space-y-4">
              {registrations.map((reg) => (
                <div
                  key={reg.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {reg.resident.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {reg.resident.email} &middot; B{reg.resident.block} -{" "}
                        {reg.resident.flatNumber}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(reg.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-gray-500">
                          <th className="pb-2 pr-4 font-medium text-xs">Name</th>
                          <th className="pb-2 pr-4 font-medium text-xs">Age</th>
                          <th className="pb-2 font-medium text-xs">Sports</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reg.participants.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-gray-50"
                          >
                            <td className="py-2 pr-4 text-gray-800">
                              {p.name}
                            </td>
                            <td className="py-2 pr-4">
                              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 capitalize">
                                {ageCategoryLabels[p.ageCategory] || p.ageCategory}
                              </span>
                            </td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1">
                                {p.sports.map((ps) => (
                                  <span
                                    key={ps.id}
                                    className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200"
                                  >
                                    {ps.sportItem.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {reg.notes && (
                    <p className="mt-2 text-xs text-gray-400 italic">
                      Note: {reg.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
