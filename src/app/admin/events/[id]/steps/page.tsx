"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRole } from "@/hooks/useRole";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Check, X } from "lucide-react";

interface StepParticipant {
  rsvpId: string | null;
  guestRsvpId: string | null;
  isGuest: boolean;
  name: string;
  block: number;
  flatNumber: string;
  dailyGoal: string;
  steps: number | null;
}

export default function AdminStepsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isAdmin, isSuperAdmin, isLoading: roleLoading } = useRole();

  const [eventTitle, setEventTitle] = useState("");
  const [participants, setParticipants] = useState<StepParticipant[]>([]);
  const [stepValues, setStepValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"" | "saved" | "error">("");

  const getKey = (p: StepParticipant) =>
    p.rsvpId ? `r-${p.rsvpId}` : `g-${p.guestRsvpId}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSaveStatus("");
    try {
      const res = await fetch(
        `/api/admin/events/${id}/steps?date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setEventTitle(data.eventTitle);
        setParticipants(data.participants);
        const vals: Record<string, string> = {};
        for (const p of data.participants) {
          const key = p.rsvpId ? `r-${p.rsvpId}` : `g-${p.guestRsvpId}`;
          vals[key] = p.steps !== null ? String(p.steps) : "";
        }
        setStepValues(vals);
        setSavedValues({ ...vals });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    if (!roleLoading && (isAdmin() || isSuperAdmin())) {
      fetchData();
    }
  }, [roleLoading, isAdmin, isSuperAdmin, fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("");
    try {
      const entries = participants.map((p) => {
        const key = getKey(p);
        const val = parseInt(stepValues[key] || "0") || 0;
        return {
          rsvpId: p.rsvpId || undefined,
          guestRsvpId: p.guestRsvpId || undefined,
          steps: val,
        };
      });

      const res = await fetch(`/api/admin/events/${id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, entries }),
      });

      if (res.ok) {
        setSaveStatus("saved");
        setSavedValues({ ...stepValues });
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const hasChanges = Object.keys(stepValues).some(
    (k) => stepValues[k] !== savedValues[k]
  );

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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-500">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link
        href={`/admin/events/${id}/rsvps`}
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium mb-6"
      >
        <ArrowLeft size={16} />
        Back to RSVP Tracking
      </Link>

      <h1 className="text-2xl font-bold text-primary-800 mb-1">
        Step Tracking
      </h1>
      <p className="text-gray-500 mb-6">{eventTitle}</p>

      {/* Date picker with nav */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => shiftDate(-1)}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          onClick={() => shiftDate(1)}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
        <span className="text-sm text-gray-500 ml-2">
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : participants.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No participants found.
        </p>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                  <th className="py-3 px-4 font-medium w-10">#</th>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Block / Flat</th>
                  <th className="py-3 px-4 font-medium">Goal</th>
                  <th className="py-3 px-4 font-medium w-32">Steps</th>
                  <th className="py-3 px-4 font-medium w-16 text-center">
                    Met
                  </th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p, index) => {
                  const key = getKey(p);
                  const val = stepValues[key] || "";
                  const stepsNum = parseInt(val) || 0;
                  const goalNum = parseInt(p.dailyGoal) || 0;
                  const metGoal = stepsNum > 0 && goalNum > 0 && stepsNum >= goalNum;
                  const isChanged = val !== (savedValues[key] || "");
                  return (
                    <tr
                      key={key}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-2 px-4 text-gray-400 text-xs">
                        {index + 1}
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {p.name}
                          </span>
                          {p.isGuest && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700">
                              Guest
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        B{p.block} - {p.flatNumber}
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        {p.dailyGoal
                          ? Number(p.dailyGoal).toLocaleString("en-IN")
                          : "\u2014"}
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={val}
                          onChange={(e) =>
                            setStepValues((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className={`w-full px-2 py-1.5 border rounded text-sm text-right focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                            isChanged
                              ? "border-blue-400 bg-blue-50"
                              : "border-gray-300"
                          }`}
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        {stepsNum > 0 ? (
                          metGoal ? (
                            <Check
                              size={16}
                              className="inline text-green-600"
                            />
                          ) : (
                            <X size={16} className="inline text-red-400" />
                          )
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save button */}
          <div className="sticky bottom-4 mt-4 flex items-center justify-end gap-3">
            {saveStatus === "saved" && (
              <span className="text-sm text-green-600 font-medium">
                Saved successfully!
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-sm text-red-500 font-medium">
                Failed to save
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm shadow-lg"
            >
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
