"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const BLOCKS = [1, 2, 3, 4];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface StaffAssignment {
  id: string;
  block: number;
  staff: { id: string; name: string };
}

interface FeedbackEntry {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  resident: { name: string; flatNumber: string } | null;
  guestName: string | null;
  guestFlat: string | null;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`text-2xl transition-colors ${s <= value ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function HousekeepingFeedbackPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [block, setBlock] = useState(1);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestFlat, setGuestFlat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Auto-fill block from resident session
  const residentBlock = (session?.user as { block?: number })?.block;
  useEffect(() => {
    if (residentBlock) setBlock(residentBlock);
  }, [residentBlock]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block, month, year]);

  async function loadData() {
    setLoading(true);
    const res = await fetch(`/api/housekeeping/feedback?block=${block}&month=${month}&year=${year}`);
    if (res.ok) {
      const data = await res.json();
      setAssignments(data.assignments ?? []);
      setFeedbackList(data.feedback ?? []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (rating === 0) { setError("Please select a rating."); return; }
    setSubmitting(true);
    const res = await fetch("/api/housekeeping/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ block, month, year, rating, comment, guestName, guestEmail, guestPhone, guestFlat }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Failed to submit."); return; }
    setSuccess(true);
    setRating(0); setComment(""); setGuestName(""); setGuestEmail(""); setGuestPhone(""); setGuestFlat("");
    loadData();
  }

  const staffForBlock = assignments.filter((a) => a.block === block);

  const inputClass = "w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Housekeeping Feedback</h1>

      {/* Block / Month picker */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Block</label>
          <select
            value={block}
            onChange={(e) => setBlock(Number(e.target.value))}
            disabled={!!residentBlock}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            {BLOCKS.map((b) => <option key={b} value={b}>Block {b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
          </select>
        </div>
      </div>

      {/* Assigned staff */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Assigned Staff — Block {block}, {MONTHS[month - 1]} {year}
        </h2>
        {staffForBlock.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No staff assigned for this block this month.</p>
        ) : (
          <ul className="space-y-1">
            {staffForBlock.map((a) => (
              <li key={a.id} className="text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {a.staff.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Feedback form */}
      {success ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-800 dark:text-green-300 text-sm">
          Thank you for your feedback!{" "}
          <button className="underline text-green-700 dark:text-green-400 ml-1" onClick={() => setSuccess(false)}>
            Submit another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Submit Feedback for Block {block}</h2>

          {/* Guest fields only when not logged in */}
          {!session?.user && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Your Name *</label>
                <input required value={guestName} onChange={(e) => setGuestName(e.target.value)} className={inputClass} placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone *</label>
                <input required value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={inputClass} placeholder="Mobile number" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={inputClass} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Flat Number *</label>
                <input required value={guestFlat} onChange={(e) => setGuestFlat(e.target.value)} className={inputClass} placeholder="e.g. 301" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rating *</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Comment (optional)</label>
            <textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Share your experience..."
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit" disabled={submitting}
            className="bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium px-5 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Feedback"}
          </button>
        </form>
      )}

      {/* Recent feedback */}
      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading feedback…</p>
      ) : feedbackList.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Recent Feedback — Block {block}, {MONTHS[month - 1]} {year}
          </h2>
          <ul className="space-y-3">
            {feedbackList.map((f) => {
              const name = f.resident?.name ?? f.guestName ?? "Anonymous";
              const flat = f.resident?.flatNumber ?? f.guestFlat ?? "";
              return (
                <li key={f.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {name}{flat ? ` · Flat ${flat}` : ""}
                    </span>
                    <span className="text-yellow-400 text-sm">{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>
                  </div>
                  {f.comment && <p className="text-sm text-gray-600 dark:text-gray-400">{f.comment}</p>}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(f.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">No feedback yet for this block and month.</p>
      )}
    </div>
  );
}
