"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2, UserCheck } from "lucide-react";
import clsx from "clsx";

interface Props {
  slug: string;
  /** When true, the form collects a rupee contribution amount and the label
   *  changes from "Register" to "Pledge my contribution". */
  contributionEnabled?: boolean;
  /** Upper bound shown to the user and enforced client-side. */
  maxContribution?: number | null;
  /** When true, the form shows an email field as required (e.g. for
   *  follow-ups like TestFlight invites). */
  requireEmail?: boolean;
  /** Optional override for the email field's helper text. */
  emailHelp?: string;
}

export default function EventRegistrationForm({
  slug,
  contributionEnabled,
  maxContribution,
  requireEmail,
  emailHelp,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [amount, setAmount] = useState("");
  // Honeypot — real users never type here because it's visually hidden.
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [prefilledName, setPrefilledName] = useState<string | null>(null);

  // Two-stage auto-fill:
  //   1) From the live NextAuth session — fills name + email immediately
  //      for any signed-in Google user, including non-residents and
  //      first-timers who haven't registered yet.
  //   2) From /api/residents/me — adds phone/block/flat for residents.
  // Both `setX((prev) => prev || …)` so user-typed values are never
  // overwritten and the two stages compose cleanly.
  useEffect(() => {
    if (!session?.user) return;
    if (session.user.name) {
      setName((prev) => prev || session.user!.name!);
      setPrefilledName((prev) => prev || session.user!.name!);
    }
    if (session.user.email) {
      setEmail((prev) => prev || session.user!.email!);
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/residents/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.name) return;
        setName((prev) => prev || data.name);
        setPhone((prev) => prev || data.phone || "");
        setEmail((prev) => prev || data.email || "");
        setBlock((prev) => prev || (data.block ? String(data.block) : ""));
        setFlatNumber((prev) => prev || data.flatNumber || "");
        setPrefilledName((prev) => prev || data.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    const phoneDigits = phone.replace(/[^\d]/g, "");
    if (phoneDigits.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (requireEmail) {
      const trimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    let amountNumber: number | undefined;
    if (contributionEnabled) {
      amountNumber = Number(String(amount).trim());
      if (!Number.isFinite(amountNumber) || amountNumber < 1) {
        setError("Please enter how much you'd like to contribute.");
        return;
      }
      if (maxContribution && amountNumber > maxContribution) {
        setError(
          `Please keep contributions ≤ ₹${maxContribution} so we can include everyone.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public-events/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          block: block ? Number(block) : undefined,
          flatNumber,
          contributionAmount: amountNumber,
          website, // honeypot
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not register. Please try again.");
        return;
      }
      // Ship to the thanks page with the cute "you're #N" position.
      const position = data.position ?? "";
      router.push(`/events/${slug}/thanks?n=${position}&name=${encodeURIComponent(name.trim().split(" ")[0])}`);
    } catch {
      setError("Network hiccup — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 sm:p-6"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {contributionEnabled ? "Pledge your contribution" : "Register"}
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {contributionEnabled
          ? "Pay via UPI after submitting. Admin will mark you as paid once received."
          : "Takes 30 seconds. No login required."}
      </p>

      {prefilledName && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs text-green-800 dark:text-green-300">
          <UserCheck size={14} />
          <span>
            Signed in as <span className="font-semibold">{prefilledName}</span>{" "}
            — your details are pre-filled. Edit if needed.
          </span>
        </div>
      )}

      {/* Honeypot: kept far off-screen + tab-out so screen readers / autofill
          may still touch it (bots), but humans never see it. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="ev-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="ev-name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g. Ramesh Iyer"
          />
        </div>

        {/* Block */}
        <div>
          <label htmlFor="ev-block" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Block
          </label>
          <select
            id="ev-block"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Select block</option>
            <option value="1">Block 1</option>
            <option value="2">Block 2</option>
            <option value="3">Block 3</option>
            <option value="4">Block 4</option>
          </select>
        </div>

        {/* Flat */}
        <div>
          <label htmlFor="ev-flat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Flat Number
          </label>
          <input
            id="ev-flat"
            type="text"
            maxLength={30}
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g. 205 or 201/202"
          />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Leave blank if you're not an RMV resident.
          </p>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="ev-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input
            id="ev-phone"
            type="tel"
            autoComplete="tel"
            required
            inputMode="tel"
            pattern="[\d\s\+\-\(\)]{10,15}"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="10-digit mobile number"
          />
        </div>

        {/* Email */}
        {requireEmail && (
          <div>
            <label
              htmlFor="ev-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="ev-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="you@example.com"
            />
            {emailHelp && (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                {emailHelp}
              </p>
            )}
          </div>
        )}

        {/* Contribution amount */}
        {contributionEnabled && (
          <div>
            <label htmlFor="ev-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contribution (₹) <span className="text-red-500">*</span>
            </label>
            <input
              id="ev-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxContribution ?? undefined}
              step={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={maxContribution ? `Up to ₹${maxContribution}` : "Amount in ₹"}
            />
            {maxContribution && (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                Max ₹{maxContribution} per person so we can include everyone.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={clsx(
          "mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-white text-base",
          submitting
            ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
            : "bg-primary-600 hover:bg-primary-700"
        )}
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {contributionEnabled ? "Saving pledge..." : "Registering..."}
          </>
        ) : (
          <>
            <Check size={18} />
            {contributionEnabled ? "Pledge" : "Register me"}
          </>
        )}
      </button>

      <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500 text-center">
        We'll only use your number to contact you about this event.
      </p>
    </form>
  );
}
