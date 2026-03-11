"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Users, Trophy, X, TrendingUp, Target, Calendar, Flame } from "lucide-react";
import type { CustomFieldType } from "@/types";

interface StepDayEntry {
  date: string;
  steps: number;
}

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
  totalSteps: number;
  dailyGoal: number;
  daysTracked: number;
  daysGoalMet: number;
  averageDailySteps: number;
  bestDay: StepDayEntry | null;
  dailySteps: StepDayEntry[];
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
  const [hasStepTracking, setHasStepTracking] = useState(false);
  const [stepLeaderboard, setStepLeaderboard] = useState<DashboardParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"total" | "average">("total");
  const [selectedParticipant, setSelectedParticipant] = useState<DashboardParticipant | null>(null);

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
        setParticipants(data.participants);
        setTotalParticipants(data.totalParticipants);
        setHasStepTracking(data.hasStepTracking);
        setStepLeaderboard(data.stepLeaderboard || []);
      } catch {
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [id]);

  // Sort leaderboard
  const sortedLeaderboard = [...stepLeaderboard].sort((a, b) =>
    sortBy === "total" ? b.totalSteps - a.totalSteps : b.averageDailySteps - a.averageDailySteps
  );

  // Filter participants by search term
  const displayList = hasStepTracking ? sortedLeaderboard : participants;
  const filteredParticipants = searchTerm
    ? displayList.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          `B${p.block}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.flatNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : displayList;

  const getRankDisplay = (index: number) => {
    if (index === 0) return <span className="text-lg">🥇</span>;
    if (index === 1) return <span className="text-lg">🥈</span>;
    if (index === 2) return <span className="text-lg">🥉</span>;
    return <span className="text-xs text-gray-400">{index + 1}</span>;
  };

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

      {/* Summary Cards */}
      <div className={`grid gap-4 mb-6 ${hasStepTracking ? "grid-cols-2 sm:grid-cols-3" : ""}`}>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-primary-50 rounded-full p-2">
            <Users size={20} className="text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalParticipants}</p>
            <p className="text-sm text-gray-500">Participants</p>
          </div>
        </div>
        {hasStepTracking && (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
              <div className="bg-green-50 rounded-full p-2">
                <Trophy size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stepLeaderboard.length}</p>
                <p className="text-sm text-gray-500">Active Trackers</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="bg-orange-50 rounded-full p-2">
                <Flame size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stepLeaderboard.length > 0
                    ? Math.max(...stepLeaderboard.map((p) => p.totalSteps)).toLocaleString("en-IN")
                    : 0}
                </p>
                <p className="text-sm text-gray-500">Top Steps</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sort Toggle (step tracking only) */}
      {hasStepTracking && stepLeaderboard.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Sort by:</span>
          <button
            onClick={() => setSortBy("total")}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              sortBy === "total"
                ? "bg-primary-100 text-primary-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Total Steps
          </button>
          <button
            onClick={() => setSortBy("average")}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              sortBy === "average"
                ? "bg-primary-100 text-primary-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Avg / Day
          </button>
        </div>
      )}

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

      {/* Participants / Leaderboard */}
      {filteredParticipants.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {searchTerm ? "No participants match your search." : "No participants yet."}
        </p>
      ) : hasStepTracking ? (
        <>
          {/* Step Leaderboard - Desktop */}
          <div className="hidden sm:block overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                  <th className="py-3 px-4 font-medium w-12 text-center">Rank</th>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Block / Flat</th>
                  <th className="py-3 px-4 font-medium text-right">Total Steps</th>
                  <th className="py-3 px-4 font-medium text-right">Avg / Day</th>
                  <th className="py-3 px-4 font-medium text-right">Goal</th>
                  <th className="py-3 px-4 font-medium text-center">Days Met</th>
                  <th className="py-3 px-4 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p, index) => (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      index < 3 ? "bg-yellow-50/30" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-center">
                      {getRankDisplay(index)}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      B{p.block} - {p.flatNumber}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      {p.totalSteps.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      {p.averageDailySteps.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {p.dailyGoal > 0 ? p.dailyGoal.toLocaleString("en-IN") : "\u2014"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.dailyGoal > 0 ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          p.daysGoalMet > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {p.daysGoalMet} / {p.daysTracked}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setSelectedParticipant(p)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Step Leaderboard - Mobile */}
          <div className="sm:hidden space-y-3">
            {filteredParticipants.map((p, index) => (
              <div
                key={p.id}
                className={`bg-white rounded-lg border border-gray-200 p-4 ${
                  index < 3 ? "border-yellow-300" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getRankDisplay(index)}
                    <p className="font-medium text-gray-900">{p.name}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    B{p.block} - {p.flatNumber}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      {p.totalSteps.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-700">
                      {p.averageDailySteps.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase">Avg/Day</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-700">
                      {p.dailyGoal > 0 ? `${p.daysGoalMet}/${p.daysTracked}` : "\u2014"}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase">Days Met</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedParticipant(p)}
                  className="w-full mt-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-md font-medium transition-colors"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Default Participant Table - Desktop */}
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

          {/* Default Participant Cards - Mobile */}
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
        </>
      )}

      {/* Result count when searching */}
      {searchTerm && filteredParticipants.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          Showing {filteredParticipants.length} of {displayList.length} participants
        </p>
      )}

      {/* Details Modal */}
      {selectedParticipant && (
        <DetailsModal
          participant={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
        />
      )}
    </div>
  );
}

function DetailsModal({
  participant: p,
  onClose,
}: {
  participant: DashboardParticipant;
  onClose: () => void;
}) {
  const maxSteps = Math.max(...p.dailySteps.map((d) => d.steps), p.dailyGoal || 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{p.name}</h2>
            <p className="text-xs text-gray-500">B{p.block} - {p.flatNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={14} className="text-blue-600" />
                <span className="text-[10px] uppercase text-blue-600 font-medium">Total Steps</span>
              </div>
              <p className="text-xl font-bold text-blue-900">{p.totalSteps.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target size={14} className="text-green-600" />
                <span className="text-[10px] uppercase text-green-600 font-medium">Days Goal Met</span>
              </div>
              <p className="text-xl font-bold text-green-900">
                {p.dailyGoal > 0 ? `${p.daysGoalMet} / ${p.daysTracked}` : "\u2014"}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={14} className="text-purple-600" />
                <span className="text-[10px] uppercase text-purple-600 font-medium">Avg / Day</span>
              </div>
              <p className="text-xl font-bold text-purple-900">{p.averageDailySteps.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Flame size={14} className="text-orange-600" />
                <span className="text-[10px] uppercase text-orange-600 font-medium">Best Day</span>
              </div>
              <p className="text-xl font-bold text-orange-900">
                {p.bestDay ? p.bestDay.steps.toLocaleString("en-IN") : "\u2014"}
              </p>
              {p.bestDay && (
                <p className="text-[10px] text-orange-600">
                  {new Date(p.bestDay.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
          </div>

          {/* Bar Chart */}
          {p.dailySteps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Steps</h3>
              <div className="flex items-end gap-1 h-32">
                {p.dailySteps.map((d) => {
                  const height = Math.max((d.steps / maxSteps) * 100, 2);
                  const metGoal = p.dailyGoal > 0 && d.steps >= p.dailyGoal;
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center justify-end h-full relative group"
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {d.steps.toLocaleString("en-IN")} steps
                        <br />
                        {new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                      <div
                        className={`w-full rounded-t transition-all ${
                          metGoal ? "bg-green-500" : "bg-blue-400"
                        }`}
                        style={{ height: `${height}%`, minHeight: "2px" }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Goal line indicator */}
              {p.dailyGoal > 0 && (
                <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                  <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Met Goal
                  <span className="inline-block w-3 h-3 rounded-sm bg-blue-400 ml-2" /> Below Goal
                  <span className="ml-auto">Goal: {p.dailyGoal.toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>
          )}

          {/* Daily Log Table */}
          {p.dailySteps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Daily Log</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <th className="py-2 px-3 text-left font-medium">Date</th>
                      <th className="py-2 px-3 text-right font-medium">Steps</th>
                      {p.dailyGoal > 0 && (
                        <th className="py-2 px-3 text-center font-medium">Goal</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...p.dailySteps].reverse().map((d) => {
                      const metGoal = p.dailyGoal > 0 && d.steps >= p.dailyGoal;
                      return (
                        <tr key={d.date} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-gray-600">
                            {new Date(d.date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900">
                            {d.steps.toLocaleString("en-IN")}
                          </td>
                          {p.dailyGoal > 0 && (
                            <td className="py-2 px-3 text-center">
                              {metGoal ? (
                                <span className="text-green-600 text-xs font-medium">&#10003;</span>
                              ) : (
                                <span className="text-red-400 text-xs">&#10007;</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {p.dailySteps.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No step data recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
