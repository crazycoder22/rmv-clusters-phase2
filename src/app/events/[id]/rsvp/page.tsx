"use client";

import { useState, useEffect, use } from "react";
import { useSession, signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import RsvpSummary from "@/components/events/RsvpSummary";
import { formatDate } from "@/lib/utils";
import type { EventConfigType, MenuItemType, CustomFieldType } from "@/types";

function getDeviceId(): string {
  const key = "rmv-feedback-device-id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID() + "-" + Date.now().toString(36);
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

function Linkify({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 underline break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

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
  fieldResponses?: { customFieldId: string; value: string; customField: CustomFieldType }[];
}

interface FlatOption {
  id: string;
  block: number;
  flatNumber: string;
}

// Shared input class for dark mode
const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";

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

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestBlock, setGuestBlock] = useState("");
  const [guestFlat, setGuestFlat] = useState("");
  const [flats, setFlats] = useState<FlatOption[]>([]);
  const [loadingFlats, setLoadingFlats] = useState(false);
  const [guestSubmitted, setGuestSubmitted] = useState(false);
  const [guestRsvpId, setGuestRsvpId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Mini Step-Up: optional run goals + accountability partner, captured inline
  // for step-tracking events (saved to /api/events/[id]/challenge after RSVP).
  type PartnerLite = { id: string; name: string; block: number | null; flatNumber: string };
  const [run5k, setRun5k] = useState("");
  const [run10k, setRun10k] = useState("");
  const [run20k, setRun20k] = useState("");
  const [existingDone, setExistingDone] = useState({ d5: 0, d10: 0, d20: 0 });
  const [partner, setPartner] = useState<PartnerLite | null>(null);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerResults, setPartnerResults] = useState<PartnerLite[]>([]);
  const [partnerPicking, setPartnerPicking] = useState(false);
  // If someone named me as their partner, surface the request right here so
  // it can't be missed (also shown on the challenge page).
  const [incomingInvite, setIncomingInvite] = useState<
    { from: { id: string; name: string; block: number | null; flatNumber: string } } | null
  >(null);
  const [inviteResponding, setInviteResponding] = useState(false);

  // Debounced partner search.
  useEffect(() => {
    if (!partnerPicking) return;
    if (partnerSearch.trim().length < 1) { setPartnerResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/residents/search?q=${encodeURIComponent(partnerSearch.trim())}`);
        if (r.ok) setPartnerResults((await r.json()).residents ?? []);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [partnerSearch, partnerPicking]);

  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [existingFeedback, setExistingFeedback] = useState<{ id: string; rating: number; comment: string | null } | null>(null);

  const isGuest = status === "unauthenticated";
  const isLoggedIn = status === "authenticated" && session?.user?.isRegistered;

  const deadlinePassed = eventConfig ? new Date() > new Date(eventConfig.rsvpDeadline) : false;
  const eventDatePassed = announcement ? new Date() > new Date(announcement.date) : false;
  void eventDatePassed;

  const feedbackEnabled = eventConfig?.enableFeedback;
  const hasFood = eventConfig ? eventConfig.menuItems && eventConfig.menuItems.length > 0 : false;
  const customFields: CustomFieldType[] = eventConfig?.customFields || [];
  const hasCustomFields = customFields.length > 0;

  useEffect(() => {
    if (!guestBlock) { setFlats([]); setGuestFlat(""); return; }
    setLoadingFlats(true);
    setGuestFlat("");
    fetch(`/api/flats?block=${guestBlock}`)
      .then((res) => res.json())
      .then((data) => setFlats(data.flats || []))
      .catch(() => setFlats([]))
      .finally(() => setLoadingFlats(false));
  }, [guestBlock]);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const url = isGuest ? `/api/events/${id}/rsvp/guest` : `/api/events/${id}/rsvp`;
        const res = await fetch(url);
        if (!res.ok) { setError("Event not found or RSVP not enabled"); return; }
        const data = await res.json();
        setAnnouncement(data.announcement);
        setEventConfig(data.eventConfig);

        if (data.myRsvp) {
          setMyRsvp(data.myRsvp);
          const plateCounts: Record<string, number> = {};
          for (const item of data.myRsvp.items) plateCounts[item.menuItemId] = item.plates;
          setPlates(plateCounts);
          setNotes(data.myRsvp.notes || "");
          if (data.myRsvp.fieldResponses) {
            const values: Record<string, string> = {};
            for (const fr of data.myRsvp.fieldResponses) values[fr.customFieldId] = fr.value;
            setFieldValues(values);
          }
        }

        // Step challenges: pull my challenge state — run-goal/partner prefill
        // plus any incoming partner invite. Runs for every logged-in user, not
        // just registered ones, so a chosen partner can see/accept the request.
        if (data.eventConfig?.stepTrackingEnabled && status === "authenticated") {
          try {
            const chRes = await fetch(`/api/events/${id}/challenge`);
            if (chRes.ok) {
              const ch = await chRes.json();
              if (ch.goal) {
                setRun5k(ch.goal.run5kGoal ? String(ch.goal.run5kGoal) : "");
                setRun10k(ch.goal.run10kGoal ? String(ch.goal.run10kGoal) : "");
                setRun20k(ch.goal.run20kGoal ? String(ch.goal.run20kGoal) : "");
                setExistingDone({ d5: ch.goal.run5kDone || 0, d10: ch.goal.run10kDone || 0, d20: ch.goal.run20kDone || 0 });
                if (ch.goal.partner) setPartner(ch.goal.partner);
              }
              setIncomingInvite(ch.incomingInvite ?? null);
            }
          } catch { /* ignore */ }
        }

        if (data.eventConfig?.enableFeedback) {
          try {
            const deviceId = getDeviceId();
            const fbRes = await fetch(`/api/events/${id}/feedback?deviceId=${encodeURIComponent(deviceId)}`);
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              if (fbData.myFeedback) {
                setExistingFeedback(fbData.myFeedback);
                setFeedbackRating(fbData.myFeedback.rating);
                setFeedbackComment(fbData.myFeedback.comment || "");
              }
            }
          } catch { /* non-critical */ }
        }
      } catch {
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    if (status === "loading") return;
    if (isGuest || isLoggedIn) fetchEvent();
    else setLoading(false);
  }, [id, status, session, isGuest, isLoggedIn]);

  const updatePlates = (menuItemId: string, count: number) => {
    setPlates((prev) => ({ ...prev, [menuItemId]: Math.max(0, count) }));
  };

  const foodTotal = hasFood && eventConfig
    ? eventConfig.menuItems.reduce((sum, item) => sum + (plates[item.id] || 0) * item.pricePerPlate, 0)
    : 0;
  const entranceFee = eventConfig?.entranceFee && eventConfig.entranceFee > 0 ? eventConfig.entranceFee : 0;
  const totalAmount = foodTotal + entranceFee;
  const hasEntranceFee = entranceFee > 0;
  const needsPayment = eventConfig?.requirePayment && totalAmount > 0;

  const submitDirectly = async (
    items: { menuItemId: string; plates: number }[],
    fieldResponsesPayload: { customFieldId: string; value: string }[]
  ) => {
    try {
      if (isGuest) {
        const res = await fetch(`/api/events/${id}/rsvp/guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: guestName, email: guestEmail, phone: guestPhone, block: Number(guestBlock), flatNumber: guestFlat, items, notes, fieldResponses: fieldResponsesPayload }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Something went wrong"); return; }
        setGuestRsvpId(data.guestRsvp.id);
        setGuestSubmitted(true);
        setSuccess("RSVP submitted successfully! Thank you.");
      } else {
        const res = await fetch(`/api/events/${id}/rsvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, notes, fieldResponses: fieldResponsesPayload }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Something went wrong"); return; }
        setMyRsvp(data.rsvp);
        // Save Mini Step-Up run goals + partner (no-op for non-step events).
        if (eventConfig?.stepTrackingEnabled) {
          await fetch(`/api/events/${id}/challenge`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              run5kGoal: Number(run5k) || 0,
              run10kGoal: Number(run10k) || 0,
              run20kGoal: Number(run20k) || 0,
              run5kDone: existingDone.d5,
              run10kDone: existingDone.d10,
              run20kDone: existingDone.d20,
              partnerResidentId: partner?.id ?? null,
            }),
          }).catch(() => {});
        }
        setSuccess(myRsvp ? "RSVP updated successfully!" : "RSVP submitted successfully!");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setSubmitting(true);

    const items = hasFood
      ? eventConfig!.menuItems.filter((item) => (plates[item.id] || 0) > 0).map((item) => ({ menuItemId: item.id, plates: plates[item.id] }))
      : [];

    if (hasFood && items.length === 0) { setError("Select at least one plate"); setSubmitting(false); return; }

    for (const cf of customFields) {
      if (cf.required && (!fieldValues[cf.id]?.trim() || fieldValues[cf.id] === "__OTHER__")) {
        setError(`"${cf.label}" is required`); setSubmitting(false); return;
      }
    }

    const fieldResponsesPayload = customFields.length > 0
      ? customFields.filter((cf) => fieldValues[cf.id]?.trim()).map((cf) => ({ customFieldId: cf.id, value: fieldValues[cf.id].trim() }))
      : [];

    if (isGuest) {
      if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) { setError("Name, email, and phone are required"); setSubmitting(false); return; }
      if (!guestBlock || !guestFlat) { setError("Please select your block and flat number"); setSubmitting(false); return; }
    }

    if (myRsvp || totalAmount === 0 || !eventConfig?.requirePayment) {
      await submitDirectly(items, fieldResponsesPayload); return;
    }

    try {
      const orderRes = await fetch(`/api/events/${id}/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, isGuest }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setError(orderData.error || "Failed to create payment order"); setSubmitting(false); return; }
      if (orderData.skipPayment) { await submitDirectly(items, fieldResponsesPayload); return; }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "RMV Clusters Phase II",
        description: `RSVP - ${announcement!.title}`,
        order_id: orderData.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            const verifyRes = await fetch(`/api/events/${id}/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                items, notes, fieldResponses: fieldResponsesPayload, isGuest,
                guestInfo: isGuest ? { name: guestName, email: guestEmail, phone: guestPhone, block: Number(guestBlock), flatNumber: guestFlat } : undefined,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) { setError(verifyData.error || "Payment verification failed"); setSubmitting(false); return; }
            if (isGuest) { setGuestRsvpId(verifyData.guestRsvp.id); setGuestSubmitted(true); }
            else setMyRsvp(verifyData.rsvp);
            setSuccess("Payment successful! RSVP submitted.");
          } catch {
            setError("Payment verification failed. Please contact the organizer.");
          } finally { setSubmitting(false); }
        },
        prefill: { name: isGuest ? guestName : session?.user?.name || "", email: isGuest ? guestEmail : session?.user?.email || "", contact: isGuest ? guestPhone : "" },
        theme: { color: "#1e40af" },
        modal: { ondismiss: () => { setSubmitting(false); setError("Payment cancelled. Your RSVP was not submitted."); } },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      setError("Failed to initiate payment. Please try again."); setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your RSVP?")) return;
    setCancelling(true); setError("");
    try {
      const res = await fetch(`/api/events/${id}/rsvp`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); setError(data.error || "Failed to cancel"); return; }
      setMyRsvp(null); setPlates({}); setNotes(""); setSuccess("RSVP cancelled successfully.");
    } catch { setError("Network error. Please try again."); }
    finally { setCancelling(false); }
  };

  const respondInvite = async (action: "accept" | "decline") => {
    setInviteResponding(true);
    try {
      await fetch(`/api/events/${id}/challenge/partner-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setIncomingInvite(null);
      setSuccess(action === "accept" ? "You're now an accountability partner!" : "Partner request declined.");
    } catch { setError("Network error. Please try again."); }
    finally { setInviteResponding(false); }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedbackRating === 0) { setFeedbackError("Please select a rating"); return; }
    setFeedbackSubmitting(true); setFeedbackError(""); setFeedbackSuccess("");
    try {
      const deviceId = getDeviceId();
      const res = await fetch(`/api/events/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: feedbackRating, comment: feedbackComment || null, deviceId }),
      });
      const data = await res.json();
      if (!res.ok) { setFeedbackError(data.error || "Failed to submit feedback"); return; }
      setExistingFeedback(data.feedback);
      setFeedbackSuccess(existingFeedback ? "Feedback updated!" : "Thank you for your feedback!");
    } catch { setFeedbackError("Network error. Please try again."); }
    finally { setFeedbackSubmitting(false); }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (status === "loading" || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (status === "authenticated" && !session?.user?.isRegistered) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Registration Required</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Please register as a resident to RSVP.</p>
        <Link href="/register" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">Go to Registration</Link>
      </div>
    );
  }

  if (!announcement || !eventConfig) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Event Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{error || "This event does not have RSVP enabled."}</p>
        <Link href="/news" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">Back to News</Link>
      </div>
    );
  }

  // Step challenges are resident-only: the leaderboard, run goals, and partner
  // are all tied to a resident account, so a guest RSVP makes no sense. Send
  // guests to log in (and bring them back here) instead of the guest form.
  if (isGuest && eventConfig?.stepTrackingEnabled) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{announcement.title}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Please log in with your resident account to register for this step challenge.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: typeof window !== "undefined" ? window.location.href : `/events/${id}/rsvp` })}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          Log in to register
        </button>
      </div>
    );
  }

  if (guestSubmitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-8">
          <h1 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">RSVP Submitted!</h1>
          <p className="text-green-700 dark:text-green-400 mb-4">
            Thank you, {guestName}! Your RSVP for &ldquo;{announcement.title}&rdquo; has been recorded.
          </p>
          {(hasFood || hasEntranceFee) && eventConfig?.requirePayment && (
            <p className="text-sm text-green-600 dark:text-green-400">Your payment has been received.</p>
          )}
          {eventConfig?.confirmationMessage && (
            <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-left">
              <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-line">
                <Linkify text={eventConfig.confirmationMessage} />
              </p>
            </div>
          )}
          {guestRsvpId && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <Link href={`/pass/g-${guestRsvpId}`} className="inline-block px-5 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors">
                View Your Event Pass
              </Link>
              <Link href={`/events/${id}/dashboard`} className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
                View Participant Dashboard &rarr;
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400">Save these links to access them anytime.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main RSVP page ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/news" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium mb-6 inline-block">
        &larr; Back to News
      </Link>

      {/* Event header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{announcement.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>{formatDate(announcement.date)}</span>
          {eventConfig.mealType && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 capitalize">
              {eventConfig.mealType}
            </span>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-3 text-sm">{announcement.summary}</p>
      </div>

      {/* Incoming accountability-partner invite */}
      {incomingInvite && (
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 mb-6">
          <p className="text-sm text-gray-800 dark:text-gray-100">
            🤝 <span className="font-semibold">{incomingInvite.from.name}</span>
            <span className="text-gray-500 dark:text-gray-400"> (B{incomingInvite.from.block ?? "—"}-{incomingInvite.from.flatNumber})</span> asked you to be their accountability partner.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={inviteResponding} onClick={() => respondInvite("accept")}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              Accept
            </button>
            <button type="button" disabled={inviteResponding} onClick={() => respondInvite("decline")}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 transition-colors">
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Deadline banner */}
      <div className={`rounded-lg p-3 mb-6 text-sm ${
        deadlinePassed
          ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
          : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
      }`}>
        {deadlinePassed
          ? "RSVP deadline has passed. You can no longer submit or modify your response."
          : `RSVP by: ${new Date(eventConfig.rsvpDeadline).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}`}
      </div>

      {/* Payment status */}
      {(hasFood || hasEntranceFee) && myRsvp && (
        <div className={`rounded-lg p-3 mb-6 text-sm ${
          myRsvp.paid
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
            : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
        }`}>
          {myRsvp.paid ? "Payment received \u2014 you're all set!" : "Payment pending \u2014 please pay the organizer."}
        </div>
      )}

      {/* Event pass & dashboard links */}
      {myRsvp && (
        <div className="mb-6 flex flex-col gap-2">
          <Link href={`/pass/r-${myRsvp.id}`} className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">View Event Pass &rarr;</Link>
          <Link href={`/events/${id}/dashboard`} className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">View Participant Dashboard &rarr;</Link>
        </div>
      )}

      {/* Confirmation message */}
      {myRsvp && eventConfig?.confirmationMessage && (
        <div className="mb-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-line">
            <Linkify text={eventConfig.confirmationMessage} />
          </p>
        </div>
      )}

      {/* Step challenge: send registered participants to set run goals + partner */}
      {myRsvp && eventConfig?.stepTrackingEnabled && (
        <Link
          href={`/steps/${id}`}
          className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
              🏃 Open your challenge page
            </p>
            <p className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-300">
              Track your steps, update run goals, and manage your accountability partner.
            </p>
          </div>
          <span className="text-xl text-indigo-500">→</span>
        </Link>
      )}

      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 mb-6">
          <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* RSVP Form */}
      <form onSubmit={handleSubmit}>

        {/* Guest info */}
        {isGuest && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Your Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input type="text" required value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Enter your full name" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input type="email" required value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Enter your email" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input type="tel" required value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Enter your phone number" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Block <span className="text-red-500">*</span>
                  </label>
                  <select required value={guestBlock} onChange={(e) => setGuestBlock(e.target.value)} className={inputClass}>
                    <option value="">Select Block</option>
                    <option value="1">Block 1</option>
                    <option value="2">Block 2</option>
                    <option value="3">Block 3</option>
                    <option value="4">Block 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Flat Number <span className="text-red-500">*</span>
                  </label>
                  <select required value={guestFlat} onChange={(e) => setGuestFlat(e.target.value)} disabled={!guestBlock || loadingFlats}
                    className={`${inputClass} disabled:opacity-60`}>
                    <option value="">{loadingFlats ? "Loading..." : !guestBlock ? "Select block first" : "Select Flat"}</option>
                    {flats.map((flat) => <option key={flat.id} value={flat.flatNumber}>{flat.flatNumber}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Menu selection */}
        {hasFood ? (
          <>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Menu — Select Plates</h2>
            <div className="space-y-3 mb-6">
              {eventConfig.menuItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">₹{item.pricePerPlate.toFixed(2)} per plate</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={deadlinePassed}
                      onClick={() => updatePlates(item.id, (plates[item.id] || 0) - 1)}
                      className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 flex items-center justify-center font-bold transition-colors">
                      &minus;
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-900 dark:text-gray-100">{plates[item.id] || 0}</span>
                    <button type="button" disabled={deadlinePassed}
                      onClick={() => updatePlates(item.id, (plates[item.id] || 0) + 1)}
                      className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 flex items-center justify-center font-bold transition-colors">
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-6">
              <RsvpSummary menuItems={eventConfig.menuItems} plates={plates} entranceFee={entranceFee} entranceFeeLabel={eventConfig?.entranceFeeLabel || "Entrance Fee"} />
            </div>
          </>
        ) : hasEntranceFee ? (
          <div className="mb-6">
            <RsvpSummary menuItems={[]} plates={{}} entranceFee={entranceFee} entranceFeeLabel={eventConfig?.entranceFeeLabel || "Entrance Fee"} />
          </div>
        ) : (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 mb-6 text-center">
            <p className="text-blue-800 dark:text-blue-300 font-medium">Confirm your attendance for this event</p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">No food ordering for this event — just RSVP to confirm.</p>
          </div>
        )}

        {/* Payment QR Code */}
        {hasEntranceFee && !eventConfig?.requirePayment && (
          <div className="mb-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3 text-center">
              Scan the QR code below to pay ₹{entranceFee.toFixed(0)} ({eventConfig?.entranceFeeLabel || "Entrance Fee"})
            </p>
            <div className="flex justify-center">
              <Image src="/images/SVB-QR.jpeg" alt="Payment QR Code" width={240} height={240} className="rounded-lg border border-amber-200 dark:border-amber-700" />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">Pay via UPI by scanning this QR code</p>
          </div>
        )}

        {/* Custom Fields */}
        {hasCustomFields && !deadlinePassed && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Additional Information</h2>
            <div className="space-y-4">
              {customFields.map((cf) => (
                <div key={cf.id}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {cf.label}{cf.required && <span className="text-red-500"> *</span>}
                  </label>
                  {cf.fieldType === "text" ? (
                    <input type="text" required={cf.required} value={fieldValues[cf.id] || ""}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [cf.id]: e.target.value }))}
                      placeholder={`Enter ${cf.label.toLowerCase()}`} className={inputClass} />
                  ) : (() => {
                    const parsedOptions: string[] = cf.options ? JSON.parse(cf.options) : [];
                    const allowOther = parsedOptions.includes("__OTHER__");
                    const displayOptions = parsedOptions.filter((o) => o !== "__OTHER__");
                    const currentValue = fieldValues[cf.id] || "";
                    const isCustomValue = allowOther && currentValue !== "" && currentValue !== "__OTHER__" && !displayOptions.includes(currentValue);
                    return (
                      <>
                        <select required={cf.required} value={isCustomValue ? "__OTHER__" : currentValue}
                          onChange={(e) => setFieldValues((prev) => ({ ...prev, [cf.id]: e.target.value }))}
                          className={inputClass}>
                          <option value="">Select {cf.label.toLowerCase()}</option>
                          {displayOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          {allowOther && <option value="__OTHER__">Other</option>}
                        </select>
                        {(currentValue === "__OTHER__" || isCustomValue) && (
                          <input type="text" required={cf.required} value={isCustomValue ? currentValue : ""}
                            onChange={(e) => setFieldValues((prev) => ({ ...prev, [cf.id]: e.target.value || "__OTHER__" }))}
                            placeholder={`Enter custom ${cf.label.toLowerCase()}`} className={`${inputClass} mt-2`} />
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {!deadlinePassed && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={hasFood ? "e.g., No spice, allergies..." : "Any notes or comments..."}
              rows={2} className={inputClass} />
          </div>
        )}

        {/* Mini Step-Up: optional run goals + accountability partner (inline) */}
        {!isGuest && eventConfig?.stepTrackingEnabled && !deadlinePassed && (
          <div className="mb-6 space-y-4 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🏃 Running goals (optional)</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">How many runs you aim to complete. Self-declared on trust; you can update these any time.</p>
              <div className="grid grid-cols-3 gap-2">
                {([["5K", run5k, setRun5k], ["10K", run10k, setRun10k], ["20K", run20k, setRun20k]] as const).map(([lbl, val, setter]) => (
                  <div key={lbl}>
                    <span className="block text-[11px] text-gray-500 mb-0.5">{lbl} runs</span>
                    <input inputMode="numeric" value={val} onChange={(e) => setter(e.target.value.replace(/\D/g, ""))} placeholder="0" className={inputClass} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🤝 Accountability partner (optional)</label>
              {partner ? (
                <div className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
                  <span className="text-sm text-gray-800 dark:text-gray-100">{partner.name} <span className="text-xs text-gray-400">B{partner.block ?? "—"}-{partner.flatNumber}</span></span>
                  <button type="button" onClick={() => { setPartner(null); setPartnerPicking(false); }} className="text-sm text-gray-400 hover:text-red-500">Remove</button>
                </div>
              ) : partnerPicking ? (
                <div>
                  <input value={partnerSearch} onChange={(e) => setPartnerSearch(e.target.value)} placeholder="Search name / flat…" className={inputClass} />
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-700">
                    {partnerResults.map((r) => (
                      <button type="button" key={r.id} onClick={() => { setPartner(r); setPartnerPicking(false); setPartnerSearch(""); setPartnerResults([]); }} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                        <span className="text-gray-800 dark:text-gray-100">{r.name}</span><span className="text-xs text-gray-400">B{r.block ?? "—"}-{r.flatNumber}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setPartnerPicking(true)} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">+ Choose a partner</button>
              )}
              <p className="mt-1 text-xs text-gray-400">Your partner gets a request to confirm.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-6">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        {!deadlinePassed && (
          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 px-4 bg-primary-600 dark:bg-primary-500 text-white font-medium rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 transition-colors">
              {submitting ? "Processing..." : myRsvp ? "Update RSVP" : needsPayment ? `Pay ₹${totalAmount.toFixed(0)} & Submit RSVP` : hasFood || hasEntranceFee ? "Submit RSVP" : "Confirm Attendance"}
            </button>
            {!isGuest && myRsvp && (
              <button type="button" onClick={handleCancel} disabled={cancelling}
                className="py-2 px-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors border border-red-200 dark:border-red-800">
                {cancelling ? "Cancelling..." : "Cancel RSVP"}
              </button>
            )}
          </div>
        )}
      </form>

      {/* Event Feedback */}
      {feedbackEnabled && (
        <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Event Feedback</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {existingFeedback ? "You have already submitted feedback. You can update it below." : "How was the event? Share your feedback."}
          </p>

          <form onSubmit={handleFeedbackSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rating <span className="text-red-500">*</span>
              </label>
              {eventConfig.feedbackStyle === "emoji" ? (
                <div className="flex gap-2">
                  {[
                    { value: 1, emoji: "😞", label: "Very Bad" },
                    { value: 2, emoji: "😕", label: "Bad" },
                    { value: 3, emoji: "😐", label: "Okay" },
                    { value: 4, emoji: "🙂", label: "Good" },
                    { value: 5, emoji: "😄", label: "Great" },
                  ].map((item) => (
                    <button key={item.value} type="button" onClick={() => setFeedbackRating(item.value)} title={item.label}
                      className={`text-3xl p-1 rounded-lg transition-all ${feedbackRating === item.value ? "bg-primary-100 dark:bg-primary-900/40 ring-2 ring-primary-400 scale-110" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                      {item.emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setFeedbackRating(star)}
                      className={`text-3xl transition-colors ${star <= feedbackRating ? "text-yellow-400" : "text-gray-300 dark:text-gray-600 hover:text-yellow-200"}`}>
                      ★
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comments (optional)</label>
              <textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Share your thoughts about the event..." rows={3} className={inputClass} />
            </div>

            {feedbackError && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-4">
                <p className="text-sm text-red-800 dark:text-red-300">{feedbackError}</p>
              </div>
            )}
            {feedbackSuccess && (
              <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 mb-4">
                <p className="text-sm text-green-800 dark:text-green-300">{feedbackSuccess}</p>
              </div>
            )}

            <button type="submit" disabled={feedbackSubmitting}
              className="py-2 px-4 bg-primary-600 dark:bg-primary-500 text-white font-medium rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 transition-colors">
              {feedbackSubmitting ? "Submitting..." : existingFeedback ? "Update Feedback" : "Submit Feedback"}
            </button>
          </form>
        </div>
      )}

      {eventConfig?.requirePayment && (hasFood || hasEntranceFee) && (
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      )}
    </div>
  );
}
