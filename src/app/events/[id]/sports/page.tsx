"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { SportsConfigType, ParticipantFormEntry } from "@/types";

interface AnnouncementInfo {
  id: string;
  title: string;
  date: string;
  summary: string;
  body: string;
  author: string;
}

interface ExistingParticipant {
  id: string;
  name: string;
  ageCategory: string;
  sports: { id: string; sportItemId: string; sportItem: { id: string; name: string } }[];
}

interface MyRegistration {
  id: string;
  participants: ExistingParticipant[];
  notes: string | null;
}

const ageCategoryLabels: Record<string, string> = {
  kid: "Kid (under 12)",
  teen: "Teen (13–17)",
  adult: "Adult (18+)",
};

export default function SportsRegistrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status } = useSession();

  const [announcement, setAnnouncement] = useState<AnnouncementInfo | null>(null);
  const [sportsConfig, setSportsConfig] = useState<SportsConfigType | null>(null);
  const [myRegistration, setMyRegistration] = useState<MyRegistration | null>(null);
  const [participants, setParticipants] = useState<ParticipantFormEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const deadlinePassed = sportsConfig
    ? new Date() > new Date(sportsConfig.registrationDeadline)
    : false;

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/events/${id}/sports`);
        if (!res.ok) {
          setError("Event not found or sports registration not enabled");
          return;
        }
        const data = await res.json();
        setAnnouncement(data.announcement);
        setSportsConfig(data.sportsConfig);

        if (data.myRegistration) {
          setMyRegistration(data.myRegistration);
          // Pre-fill participants from existing registration
          setParticipants(
            data.myRegistration.participants.map((p: ExistingParticipant) => ({
              tempId: crypto.randomUUID(),
              name: p.name,
              ageCategory: p.ageCategory as "kid" | "teen" | "adult",
              sportItemIds: p.sports.map(
                (s: { sportItemId: string }) => s.sportItemId
              ),
            }))
          );
          setNotes(data.myRegistration.notes || "");
        }
      } catch {
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated" && session?.user?.isRegistered) {
      fetchEvent();
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [id, status, session]);

  const addParticipant = () => {
    setParticipants((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        name: "",
        ageCategory: "adult",
        sportItemIds: [],
      },
    ]);
  };

  const removeParticipant = (tempId: string) => {
    setParticipants((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const updateParticipant = (
    tempId: string,
    field: "name" | "ageCategory",
    value: string
  ) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.tempId === tempId ? { ...p, [field]: value } : p
      )
    );
  };

  const toggleSport = (tempId: string, sportItemId: string) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        const has = p.sportItemIds.includes(sportItemId);
        return {
          ...p,
          sportItemIds: has
            ? p.sportItemIds.filter((id) => id !== sportItemId)
            : [...p.sportItemIds, sportItemId],
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    // Client-side validation
    if (participants.length === 0) {
      setError("Add at least one participant");
      setSubmitting(false);
      return;
    }

    for (const p of participants) {
      if (!p.name.trim()) {
        setError("Each participant must have a name");
        setSubmitting(false);
        return;
      }
      if (p.sportItemIds.length === 0) {
        setError(`"${p.name}" must select at least one sport`);
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/events/${id}/sports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setMyRegistration(data.registration);
      setSuccess(
        myRegistration
          ? "Registration updated successfully!"
          : "Registration submitted successfully!"
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your registration?")) return;
    setCancelling(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${id}/sports`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to cancel");
        return;
      }
      setMyRegistration(null);
      setParticipants([]);
      setNotes("");
      setSuccess("Registration cancelled successfully.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  // Auth states
  if (status === "loading" || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Sign In Required</h1>
        <p className="text-gray-500 mb-4">Please sign in to register for this event.</p>
        <Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">
          Go to Home
        </Link>
      </div>
    );
  }

  if (!session?.user?.isRegistered) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Registration Required</h1>
        <p className="text-gray-500 mb-4">Please register as a resident first.</p>
        <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
          Go to Registration
        </Link>
      </div>
    );
  }

  if (!announcement || !sportsConfig) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Event Not Found</h1>
        <p className="text-gray-500 mb-4">
          {error || "This event does not have sports registration enabled."}
        </p>
        <Link href="/news" className="text-primary-600 hover:text-primary-700 font-medium">
          Back to News
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Back link */}
      <Link
        href="/news"
        className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-6 inline-block"
      >
        &larr; Back to News
      </Link>

      {/* Event header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {announcement.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>{formatDate(announcement.date)}</span>
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
            Sports Event
          </span>
        </div>
        <p className="text-gray-600 mt-3 text-sm">{announcement.summary}</p>
      </div>

      {/* Deadline info */}
      <div
        className={`rounded-lg p-3 mb-6 text-sm ${
          deadlinePassed
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-blue-50 border border-blue-200 text-blue-700"
        }`}
      >
        {deadlinePassed
          ? "Registration deadline has passed. You can no longer submit or modify your registration."
          : `Register by: ${new Date(sportsConfig.registrationDeadline).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}`}
      </div>

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 mb-6">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Available sports */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Available Sports
        </h2>
        <div className="flex flex-wrap gap-2">
          {sportsConfig.sportItems.map((sport) => (
            <span
              key={sport.id}
              className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200"
            >
              {sport.name}
            </span>
          ))}
        </div>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Participants</h2>
          {!deadlinePassed && (
            <button
              type="button"
              onClick={addParticipant}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              + Add Participant
            </button>
          )}
        </div>

        {participants.length === 0 && (
          <p className="text-sm text-gray-400 italic mb-6">
            No participants added yet. Click &quot;+ Add Participant&quot; to
            register yourself, your kids, or family members.
          </p>
        )}

        <div className="space-y-4 mb-6">
          {participants.map((participant, index) => (
            <div
              key={participant.tempId}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">
                  Participant {index + 1}
                </span>
                {!deadlinePassed && (
                  <button
                    type="button"
                    onClick={() => removeParticipant(participant.tempId)}
                    className="text-red-400 hover:text-red-600 text-sm font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={participant.name}
                    onChange={(e) =>
                      updateParticipant(participant.tempId, "name", e.target.value)
                    }
                    disabled={deadlinePassed}
                    placeholder="Participant name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Age Category
                  </label>
                  <select
                    value={participant.ageCategory}
                    onChange={(e) =>
                      updateParticipant(
                        participant.tempId,
                        "ageCategory",
                        e.target.value
                      )
                    }
                    disabled={deadlinePassed}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-50"
                  >
                    <option value="kid">{ageCategoryLabels.kid}</option>
                    <option value="teen">{ageCategoryLabels.teen}</option>
                    <option value="adult">{ageCategoryLabels.adult}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Select Sports
                </label>
                <div className="flex flex-wrap gap-2">
                  {sportsConfig.sportItems.map((sport) => {
                    const selected = participant.sportItemIds.includes(sport.id);
                    return (
                      <button
                        key={sport.id}
                        type="button"
                        disabled={deadlinePassed}
                        onClick={() => toggleSport(participant.tempId, sport.id)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors font-medium disabled:opacity-60 ${
                          selected
                            ? "bg-orange-600 text-white border-orange-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600"
                        }`}
                      >
                        {sport.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {!deadlinePassed && participants.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Any special requirements..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        {!deadlinePassed && participants.length > 0 && (
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 px-4 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {submitting
                ? myRegistration
                  ? "Updating..."
                  : "Submitting..."
                : myRegistration
                  ? "Update Registration"
                  : "Submit Registration"}
            </button>
            {myRegistration && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="py-2 px-4 bg-red-50 text-red-700 font-medium rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
              >
                {cancelling ? "Cancelling..." : "Cancel Registration"}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
