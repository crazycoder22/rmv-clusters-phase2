"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import clsx from "clsx";

interface Props {
  slug: string;
}

export default function EventRegistrationForm({ slug }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  // Honeypot — real users never type here because it's visually hidden.
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public-events/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          block: block ? Number(block) : undefined,
          flatNumber,
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
        Register
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Takes 30 seconds. No login required.
      </p>

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
            Registering...
          </>
        ) : (
          <>
            <Check size={18} />
            Register me
          </>
        )}
      </button>

      <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500 text-center">
        We'll only use your number to contact you about this event.
      </p>
    </form>
  );
}
