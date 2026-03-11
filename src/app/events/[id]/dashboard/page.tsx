"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Users } from "lucide-react";
import type { CustomFieldType } from "@/types";

interface DashboardParticipant {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
  paid: boolean;
  fieldResponses: {
    customFieldId: string;
    customField: { label: string };
    value: string;
  }[];
  createdAt: string;
}

export default function EventDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [eventTitle, setEventTitle] = useState("");
  const [eventSummary, setEventSummary] = useState("");
  const [customFields, setCustomFields] = useState<CustomFieldType[]>([]);
  const [participants, setParticipants] = useState<DashboardParticipant[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [entranceFee, setEntranceFee] = useState(0);
  const [entranceFeeLabel, setEntranceFeeLabel] = useState("Entrance Fee");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(`/api/events/${id}/dashboard`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load dashboard");
          return;
        }
        const data = await res.json();
        setEventTitle(data.announcement.title);
        setEventSummary(data.announcement.summary);
        setCustomFields(data.eventConfig.customFields || []);
        setEntranceFee(data.eventConfig.entranceFee || 0);
        setEntranceFeeLabel(data.eventConfig.entranceFeeLabel || "Entrance Fee");
        setParticipants(data.participants);
        setTotalParticipants(data.totalParticipants);
      } catch {
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [id]);

  // Filter participants by search term
  const filteredParticipants = searchTerm
    ? participants.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          `B${p.block}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.flatNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : participants;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-center text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        <Link
          href={`/events/${id}/rsvp`}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
        >
          &larr; Back to Event
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <Link
        href={`/events/${id}/rsvp`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} />
        Back to Event
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{eventTitle}</h1>
        {eventSummary && (
          <p className="text-gray-500 text-sm">{eventSummary}</p>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex items-center gap-3">
        <div className="bg-primary-50 rounded-full p-2">
          <Users size={20} className="text-primary-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{totalParticipants}</p>
          <p className="text-sm text-gray-500">Registered Participants</p>
        </div>
      </div>

      {/* Search */}
      {totalParticipants > 5 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, block, or flat..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Participants */}
      {filteredParticipants.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {searchTerm ? "No participants match your search." : "No participants yet."}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                  <th className="py-3 px-4 font-medium w-10">#</th>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Block / Flat</th>
                  {customFields.map((cf) => (
                    <th key={cf.id} className="py-3 px-4 font-medium">
                      {cf.label}
                    </th>
                  ))}
                  {entranceFee > 0 && (
                    <th className="py-3 px-4 font-medium">{entranceFeeLabel}</th>
                  )}
                  {entranceFee > 0 && (
                    <th className="py-3 px-4 font-medium">Paid</th>
                  )}
                  <th className="py-3 px-4 font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p, index) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      B{p.block} - {p.flatNumber}
                    </td>
                    {customFields.map((cf) => {
                      const response = p.fieldResponses.find(
                        (fr) => fr.customFieldId === cf.id
                      );
                      return (
                        <td key={cf.id} className="py-3 px-4 text-gray-700">
                          {response?.value || "\u2014"}
                        </td>
                      );
                    })}
                    {entranceFee > 0 && (
                      <td className="py-3 px-4 text-gray-700">
                        {"\u20B9"}{entranceFee.toFixed(0)}
                      </td>
                    )}
                    {entranceFee > 0 && (
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          p.paid
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}>
                          {p.paid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filteredParticipants.map((p, index) => (
              <div
                key={p.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center">
                      {index + 1}
                    </span>
                    <p className="font-medium text-gray-900">{p.name}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    B{p.block} - {p.flatNumber}
                  </span>
                </div>
                {customFields.map((cf) => {
                  const response = p.fieldResponses.find(
                    (fr) => fr.customFieldId === cf.id
                  );
                  if (!response) return null;
                  return (
                    <div key={cf.id} className="text-sm text-gray-600 mt-1">
                      <span className="font-medium text-gray-500">
                        {cf.label}:
                      </span>{" "}
                      {response.value}
                    </div>
                  );
                })}
                {entranceFee > 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">
                      <span className="font-medium text-gray-500">{entranceFeeLabel}:</span>{" "}
                      {"\u20B9"}{entranceFee.toFixed(0)}
                    </span>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      p.paid
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {p.paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Registered{" "}
                  {new Date(p.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>

          {/* Result count when searching */}
          {searchTerm && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              Showing {filteredParticipants.length} of {totalParticipants} participants
            </p>
          )}
        </>
      )}
    </div>
  );
}
