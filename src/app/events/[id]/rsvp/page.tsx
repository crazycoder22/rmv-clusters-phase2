"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import RsvpSummary from "@/components/events/RsvpSummary";
import { formatDate } from "@/lib/utils";
import type { EventConfigType, MenuItemType } from "@/types";

interface AnnouncementInfo {
  id: string;
  title: string;
  date: string;
  summary: string;
  body?: string;
  author?: string;
}

interface MyRsvp {
  id: string;
  items: { menuItemId: string; plates: number; menuItem: MenuItemType }[];
  paid: boolean;
  notes: string | null;
}

interface FlatOption {
  id: string;
  block: number;
  flatNumber: string;
}

export default function RsvpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();

  const [announcement, setAnnouncement] = useState<AnnouncementInfo | null>(null);
  const [eventConfig, setEventConfig] = useState<EventConfigType | null>(null);
  const [myRsvp, setMyRsvp] = useState<MyRsvp | null>(null);
  const [plates, setPlates] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Guest form fields
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestBlock, setGuestBlock] = useState("");
  const [guestFlat, setGuestFlat] = useState("");
  const [flats, setFlats] = useState<FlatOption[]>([]);
  const [loadingFlats, setLoadingFlats] = useState(false);
  const [guestSubmitted, setGuestSubmitted] = useState(false);

  const isGuest = status === "unauthenticated";
  const isLoggedIn = status === "authenticated" && session?.user?.isRegistered;

  const deadlinePassed = eventConfig
    ? new Date() > new Date(eventConfig.rsvpDeadline)
    : false;

  // Fetch flats when guest selects a block
  useEffect(() => {
    if (!guestBlock) {
      setFlats([]);
      setGuestFlat("");
      return;
    }
    setLoadingFlats(true);
    setGuestFlat("");
    fetch(`/api/flats?block=${guestBlock}`)
      .then((res) => res.json())
      .then((data) => setFlats(data.flats || []))
      .catch(() => setFlats([]))
      .finally(() => setLoadingFlats(false));
  }, [guestBlock]);

  // Fetch event data
  useEffect(() => {
    async function fetchEvent() {
      try {
        // Guest uses public endpoint, logged-in uses auth endpoint
        const url = isGuest
          ? `/api/events/${id}/rsvp/guest`
          : `/api/events/${id}/rsvp`;
        const res = await fetch(url);
        if (!res.ok) {
          setError("Event not found or RSVP not enabled");
          return;
        }
        const data = await res.json();
        setAnnouncement(data.announcement);
        setEventConfig(data.eventConfig);

        if (data.myRsvp) {
          setMyRsvp(data.myRsvp);
          const plateCounts: Record<string, number> = {};
          for (const item of data.myRsvp.items) {
            plateCounts[item.menuItemId] = item.plates;
          }
          setPlates(plateCounts);
          setNotes(data.myRsvp.notes || "");
        }
      } catch {
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    if (status === "loading") return;

    if (isGuest || isLoggedIn) {
      fetchEvent();
    } else {
      // Logged in but not registered
      setLoading(false);
    }
  }, [id, status, session, isGuest, isLoggedIn]);

  const updatePlates = (menuItemId: string, count: number) => {
    setPlates((prev) => ({ ...prev, [menuItemId]: Math.max(0, count) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    const items = eventConfig!.menuItems
      .filter((item) => (plates[item.id] || 0) > 0)
      .map((item) => ({ menuItemId: item.id, plates: plates[item.id] }));

    if (items.length === 0) {
      setError("Select at least one plate");
      setSubmitting(false);
      return;
    }

    try {
      if (isGuest) {
        // Guest submission
        if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
          setError("Name, email, and phone are required");
          setSubmitting(false);
          return;
        }
        if (!guestBlock || !guestFlat) {
          setError("Please select your block and flat number");
          setSubmitting(false);
          return;
        }

        const res = await fetch(`/api/events/${id}/rsvp/guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: guestName,
            email: guestEmail,
            phone: guestPhone,
            block: Number(guestBlock),
            flatNumber: guestFlat,
            items,
            notes,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong");
          return;
        }
        setGuestSubmitted(true);
        setSuccess("RSVP submitted successfully! Thank you.");
      } else {
        // Logged-in submission
        const res = await fetch(`/api/events/${id}/rsvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, notes }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong");
          return;
        }
        setMyRsvp(data.rsvp);
        setSuccess(myRsvp ? "RSVP updated successfully!" : "RSVP submitted successfully!");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your RSVP?")) return;
    setCancelling(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${id}/rsvp`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to cancel");
        return;
      }
      setMyRsvp(null);
      setPlates({});
      setNotes("");
      setSuccess("RSVP cancelled successfully.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  // Loading state
  if (status === "loading" || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Logged in but not registered
  if (status === "authenticated" && !session?.user?.isRegistered) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Registration Required</h1>
        <p className="text-gray-500 mb-4">Please register as a resident to RSVP.</p>
        <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
          Go to Registration
        </Link>
      </div>
    );
  }

  // Event not found
  if (!announcement || !eventConfig) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Event Not Found</h1>
        <p className="text-gray-500 mb-4">{error || "This event does not have RSVP enabled."}</p>
        <Link href="/news" className="text-primary-600 hover:text-primary-700 font-medium">
          Back to News
        </Link>
      </div>
    );
  }

  // Guest already submitted
  if (guestSubmitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="rounded-lg bg-green-50 border border-green-200 p-8">
          <h1 className="text-2xl font-bold text-green-800 mb-2">RSVP Submitted!</h1>
          <p className="text-green-700 mb-4">
            Thank you, {guestName}! Your RSVP for &ldquo;{announcement.title}&rdquo; has been recorded.
          </p>
          <p className="text-sm text-green-600">
            Please contact the organizer for payment details.
          </p>
        </div>
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
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 capitalize">
            {eventConfig.mealType}
          </span>
        </div>
        <p className="text-gray-600 mt-3 text-sm">{announcement.summary}</p>
      </div>

      {/* Deadline info */}
      <div className={`rounded-lg p-3 mb-6 text-sm ${
        deadlinePassed
          ? "bg-red-50 border border-red-200 text-red-700"
          : "bg-blue-50 border border-blue-200 text-blue-700"
      }`}>
        {deadlinePassed
          ? "RSVP deadline has passed. You can no longer submit or modify your response."
          : `RSVP by: ${new Date(eventConfig.rsvpDeadline).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}`}
      </div>

      {/* Payment status for existing RSVP (logged-in users only) */}
      {myRsvp && (
        <div className={`rounded-lg p-3 mb-6 text-sm ${
          myRsvp.paid
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}>
          {myRsvp.paid
            ? "Payment received \u2014 you're all set!"
            : "Payment pending \u2014 please pay the organizer."}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 mb-6">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* RSVP Form */}
      <form onSubmit={handleSubmit}>
        {/* Guest info fields (only for non-logged-in users) */}
        {isGuest && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Your Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="Enter your phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Block <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={guestBlock}
                    onChange={(e) => setGuestBlock(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select Block</option>
                    <option value="1">Block 1</option>
                    <option value="2">Block 2</option>
                    <option value="3">Block 3</option>
                    <option value="4">Block 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flat Number <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={guestFlat}
                    onChange={(e) => setGuestFlat(e.target.value)}
                    disabled={!guestBlock || loadingFlats}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                  >
                    <option value="">
                      {loadingFlats ? "Loading..." : !guestBlock ? "Select block first" : "Select Flat"}
                    </option>
                    {flats.map((flat) => (
                      <option key={flat.id} value={flat.flatNumber}>
                        {flat.flatNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Menu selection */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Menu — Select Plates
        </h2>

        <div className="space-y-3 mb-6">
          {eventConfig.menuItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-white rounded-lg p-4 border border-gray-200"
            >
              <div>
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-500">{"\u20B9"}{item.pricePerPlate.toFixed(2)} per plate</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={deadlinePassed}
                  onClick={() => updatePlates(item.id, (plates[item.id] || 0) - 1)}
                  className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 flex items-center justify-center font-bold"
                >
                  &minus;
                </button>
                <span className="w-8 text-center font-semibold text-gray-900">
                  {plates[item.id] || 0}
                </span>
                <button
                  type="button"
                  disabled={deadlinePassed}
                  onClick={() => updatePlates(item.id, (plates[item.id] || 0) + 1)}
                  className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="mb-6">
          <RsvpSummary menuItems={eventConfig.menuItems} plates={plates} />
        </div>

        {/* Notes */}
        {!deadlinePassed && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., No spice, allergies..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        {!deadlinePassed && (
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 px-4 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting
                ? "Submitting..."
                : isGuest
                  ? "Submit RSVP"
                  : myRsvp ? "Update RSVP" : "Submit RSVP"}
            </button>
            {!isGuest && myRsvp && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="py-2 px-4 bg-red-50 text-red-700 font-medium rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
              >
                {cancelling ? "Cancelling..." : "Cancel RSVP"}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
