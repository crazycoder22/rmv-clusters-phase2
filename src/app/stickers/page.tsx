"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Car,
  Bike,
  Check,
  Loader2,
  ShieldCheck,
  UserCheck,
  MapPin,
  Clock,
} from "lucide-react";
import clsx from "clsx";

// ── Pickup schedule ───────────────────────────────────────────────────────
// Shown in the post-submit Thanks panel so residents who arrive via the
// WhatsApp link still see where to pick up their stickers. Process info
// (MyGate tutorial, where-to-stick, etc.) lives in the WhatsApp message.
const HELP_DESK_SCHEDULE: { when: string; where: string }[] = [
  { when: "Friday 22 May, 4 – 6 PM", where: "Near the jack fruit tree" },
  { when: "Saturday 23 May, 10 AM – 1 PM", where: "Near the jack fruit tree" },
];

type ResidentType = "OWNER" | "TENANT";

export default function VehicleStickerPage() {
  const { data: session } = useSession();

  // Form state
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [residentName, setResidentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [residentType, setResidentType] = useState<ResidentType | "">("");
  const [fourWheelers, setFourWheelers] = useState(0);
  const [twoWheelers, setTwoWheelers] = useState(0);
  const [mygateRegistered, setMygateRegistered] = useState(false);
  const [alreadyHasSticker, setAlreadyHasSticker] = useState(false);
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { updated: boolean }>(null);
  const [prefilledName, setPrefilledName] = useState<string | null>(null);

  // Auto-fill from signed-in resident session (same pattern as event form).
  useEffect(() => {
    if (!session?.user) return;
    if (session.user.name) {
      setResidentName((prev) => prev || session.user!.name!);
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
        setResidentName((prev) => prev || data.name);
        setPhone((prev) => prev || data.phone || "");
        setEmail((prev) => prev || data.email || "");
        setBlock((prev) => prev || (data.block ? String(data.block) : ""));
        setFlatNumber((prev) => prev || data.flatNumber || "");
        // Map resident type — DB has OWNER/TENANT/OWNER_FAMILY/TENANT_FAMILY/MULTI_TENANT.
        // For sticker purposes we collapse to OWNER/TENANT.
        if (data.residentType) {
          const t = String(data.residentType);
          if (t.startsWith("OWNER")) setResidentType((prev) => prev || "OWNER");
          else if (t.startsWith("TENANT") || t === "MULTI_TENANT") {
            setResidentType((prev) => prev || "TENANT");
          }
        }
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

    if (!block) return setError("Please select your block.");
    if (!flatNumber.trim()) return setError("Please enter your flat number.");
    if (residentName.trim().length < 2)
      return setError("Please enter your full name.");
    if (phone.replace(/[^\d]/g, "").length < 10)
      return setError("Please enter a valid 10-digit mobile number.");
    if (!residentType) return setError("Please pick Owner or Tenant.");
    if (fourWheelers + twoWheelers === 0)
      return setError("Please enter at least one 4-wheeler or 2-wheeler sticker.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/stickers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block: Number(block),
          flatNumber: flatNumber.trim(),
          residentName: residentName.trim(),
          phone,
          email: email || undefined,
          residentType,
          fourWheelers,
          twoWheelers,
          mygateRegistered,
          alreadyHasSticker,
          notes: notes.trim() || undefined,
          website, // honeypot
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit. Please try again.");
        return;
      }
      setDone({ updated: !!data.updated });
    } catch {
      setError("Network hiccup — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <ThanksPanel updated={done.updated} onAgain={() => setDone(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/40 via-white to-white dark:from-primary-950/40 dark:via-gray-900 dark:to-gray-900 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-300 mb-5"
        >
          <ArrowLeft size={14} />
          Back to RMV Clusters
        </Link>

        {/* Title — process info lives in the WhatsApp announcement,
            so the page itself stays focused on the form. */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <ShieldCheck
              size={20}
              className="text-emerald-700 dark:text-emerald-300"
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              Vehicle Sticker Registration
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              For the new security agency starting 25 May 2026.
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 sm:p-6"
        >
          {prefilledName && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs text-green-800 dark:text-green-300">
              <UserCheck size={14} />
              <span>
                Signed in as{" "}
                <span className="font-semibold">{prefilledName}</span> — your
                details are pre-filled. Edit if needed.
              </span>
            </div>
          )}

          {/* Honeypot */}
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
            {/* Block + Flat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="vs-block"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Block <span className="text-red-500">*</span>
                </label>
                <select
                  id="vs-block"
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
              <div>
                <label
                  htmlFor="vs-flat"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Flat Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="vs-flat"
                  type="text"
                  maxLength={30}
                  required
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. 205 or G3"
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="vs-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="vs-name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                value={residentName}
                onChange={(e) => setResidentName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g. Ramesh Iyer"
              />
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="vs-phone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                id="vs-phone"
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

            {/* Email (optional) */}
            <div>
              <label
                htmlFor="vs-email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email{" "}
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  (optional)
                </span>
              </label>
              <input
                id="vs-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {/* Owner / Tenant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Are you the Owner or a Tenant?{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["OWNER", "TENANT"] as ResidentType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setResidentType(t)}
                    className={clsx(
                      "px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                      residentType === t
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                        : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-400"
                    )}
                  >
                    {t === "OWNER" ? "Owner" : "Tenant"}
                  </button>
                ))}
              </div>
            </div>

            {/* Sticker counts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How many stickers do you need?{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CounterField
                  icon={<Car size={18} />}
                  label="4-wheelers (cars)"
                  value={fourWheelers}
                  onChange={setFourWheelers}
                />
                <CounterField
                  icon={<Bike size={18} />}
                  label="2-wheelers (bikes/scooters)"
                  value={twoWheelers}
                  onChange={setTwoWheelers}
                />
              </div>
            </div>

            {/* Self-declared compliance checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quick status check
              </label>
              <div className="space-y-2">
                <CheckboxField
                  checked={mygateRegistered}
                  onChange={setMygateRegistered}
                  label="I have already added all vehicle details in MyGate"
                  hint="Needed before we give you stickers."
                />
                <CheckboxField
                  checked={alreadyHasSticker}
                  onChange={setAlreadyHasSticker}
                  label="I already have stickers"
                  hint="No new stickers required."
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="vs-notes"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Notes{" "}
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  (optional)
                </span>
              </label>
              <textarea
                id="vs-notes"
                rows={3}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g. One car is out of station, will pick up sticker later."
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
                Saving…
              </>
            ) : (
              <>
                <Check size={18} />
                Submit my sticker request
              </>
            )}
          </button>

          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500 text-center">
            Your details are visible only to RMV admins. No login required.
          </p>
        </form>
      </div>
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={clsx(
        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
        checked
          ? "border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20"
          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-600"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {label}
        </div>
        {hint && (
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {hint}
          </div>
        )}
      </div>
    </label>
  );
}

function CounterField({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(10, n));
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3">
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 text-sm font-medium">
        <span className="text-primary-600 dark:text-primary-400">{icon}</span>
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= 0}
          className="w-9 h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          max={10}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(clamp(parseInt(e.target.value || "0", 10)))}
          className="flex-1 text-center text-lg font-semibold px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= 10}
          className="w-9 h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ThanksPanel({
  updated,
  onAgain,
}: {
  updated: boolean;
  onAgain: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-primary-50/40 via-white to-white dark:from-primary-950/40 dark:via-gray-900 dark:to-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 sm:p-7">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Check size={28} className="text-emerald-700 dark:text-emerald-300" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {updated ? "Updated!" : "Thanks — we've got it!"}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {updated
              ? "Your sticker request has been updated. We'll use the latest count for printing."
              : "Your sticker request is recorded. Here's how to collect your stickers."}
          </p>
        </div>

        {/* Pickup details — repeated here so residents see them after submit too */}
        <div className="mt-5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-900 dark:text-emerald-200">
          <p className="font-semibold mb-2">Pick up at any of these:</p>
          <ul className="space-y-2 text-xs">
            {HELP_DESK_SCHEDULE.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <Clock size={12} className="shrink-0 mt-0.5" />
                <span>
                  <strong>{s.when}</strong> · {s.where}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2">
              <MapPin size={12} className="shrink-0 mt-0.5" />
              <span>
                <strong>25 May (Mon) morning</strong> · near the main gate
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin size={12} className="shrink-0 mt-0.5" />
              <span>
                <strong>Block 2 office</strong> · manager has spare stickers on
                working days
              </span>
            </li>
          </ul>
          <p className="mt-3 text-[11px] italic">
            Don&apos;t forget — register vehicles in MyGate first if you
            haven&apos;t already.
          </p>
        </div>

        {/* Where to stick — shown after submit so it's top-of-mind for pickup day */}
        <div className="mt-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-3 text-sm text-purple-900 dark:text-purple-200">
          <p className="font-semibold mb-2">After you collect — where to stick:</p>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-start gap-2">
              <Car size={12} className="shrink-0 mt-0.5" />
              <span>
                <strong>Car:</strong> top corner of windshield, side closest to
                the guard cabin.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Bike size={12} className="shrink-0 mt-0.5" />
              <span>
                <strong>Bike / scooter:</strong> front fairing or below the
                headlight.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs font-semibold leading-snug">
            🚨 Sticker visible → guard waves you through. No sticker → guard
            stops and checks.
          </p>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onAgain}
            className="px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium"
          >
            Submit another flat
          </button>
          <Link
            href="/"
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
