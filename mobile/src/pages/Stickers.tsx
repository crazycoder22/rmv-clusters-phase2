import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  Car,
  Check,
  Clock,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

// Pickup schedule mirrors the web /stickers page so residents who arrive
// from either surface see the same info. Update both together.
const HELP_DESK_SCHEDULE: { when: string; where: string }[] = [
  { when: "Friday 22 May, 4 – 6 PM", where: "Near the jack fruit tree" },
  { when: "Saturday 23 May, 10 AM – 1 PM", where: "Near the jack fruit tree" },
];

type ResidentType = "OWNER" | "TENANT";

export default function Stickers() {
  const { user, token } = useAuth();

  // Form state
  const [block, setBlock] = useState<string>("");
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
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { updated: boolean }>(null);

  // Auto-fill from the signed-in resident on mount.
  useEffect(() => {
    if (!user) return;
    setResidentName((prev) => prev || user.name);
    setEmail((prev) => prev || user.email);
    setPhone((prev) => prev || user.phone);
    setBlock((prev) => prev || (user.block ? String(user.block) : ""));
    setFlatNumber((prev) => prev || user.flatNumber);
  }, [user]);

  const prefilledFromAccount = useMemo(() => {
    return !!user && residentName === user.name;
  }, [user, residentName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation — keep messages identical to the web form so
    // residents who try both surfaces get a consistent experience.
    const blockNum = Number(block);
    if (!Number.isInteger(blockNum) || blockNum < 1 || blockNum > 4) {
      setError("Please select your block (1, 2, 3 or 4).");
      return;
    }
    if (!flatNumber.trim()) {
      setError("Please enter your flat number.");
      return;
    }
    if (residentName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (phone.replace(/[^\d]/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (residentType !== "OWNER" && residentType !== "TENANT") {
      setError("Please pick Owner or Tenant.");
      return;
    }
    if (fourWheelers + twoWheelers === 0) {
      setError("Please enter at least one 4-wheeler or 2-wheeler sticker.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/stickers/register", {
        method: "POST",
        // The endpoint is public; we still pass the token so the request
        // looks like every other one this app makes (and a future revision
        // could choose to use the session).
        token,
        body: JSON.stringify({
          block: blockNum,
          flatNumber: flatNumber.trim(),
          residentName: residentName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          residentType,
          fourWheelers,
          twoWheelers,
          notes: notes.trim() || undefined,
          mygateRegistered,
          alreadyHasSticker,
          website, // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not submit. Please try again.");
        return;
      }
      setDone({ updated: !!data.updated });
      // Reset the parts we don't want stuck around (the form auto-fills
      // most fields again on next entry, which is what residents want).
      setNotes("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Thanks panel ─────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
        <header className="flex items-center gap-2 py-4">
          <Link
            to="/more"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-white">Vehicle stickers</h1>
        </header>

        <section className="mb-5 rounded-2xl border border-emerald-700 bg-emerald-900/30 p-5">
          <div className="flex items-center gap-2 text-emerald-300">
            <Check size={18} />
            <p className="text-sm font-semibold">
              {done.updated ? "Updated!" : "Got it — thank you!"}
            </p>
          </div>
          <p className="mt-1 text-sm text-emerald-200/90">
            {alreadyHasSticker
              ? "Marked as already collected. If you change your mind, you can resubmit any time."
              : "We've added your request to the list. Pickup details below."}
          </p>
        </section>

        {!alreadyHasSticker && (
          <section className="mb-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sticker pickup
            </h2>
            <div className="space-y-2">
              {HELP_DESK_SCHEDULE.map((s, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"
                >
                  <div className="flex items-start gap-2 text-sm text-white">
                    <Clock size={15} className="mt-0.5 text-indigo-300" />
                    <span>{s.when}</span>
                  </div>
                  <div className="mt-1 flex items-start gap-2 text-xs text-slate-300">
                    <MapPin size={13} className="mt-0.5 text-indigo-300" />
                    <span>{s.where}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Bring your phone — we may check the MyGate vehicle entry
              before handing over stickers.
            </p>
          </section>
        )}

        <div className="mt-auto pb-4">
          <button
            onClick={() => setDone(null)}
            className="block w-full rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-center text-sm font-semibold text-white active:bg-slate-800"
          >
            Submit another flat
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Vehicle stickers</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 pb-6">
        <section className="rounded-2xl border border-indigo-700/60 bg-indigo-900/20 p-4">
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-indigo-300" />
            <p className="text-xs text-indigo-100/90">
              The new security agency requires{" "}
              <span className="font-semibold text-white">RMV-issued stickers</span>{" "}
              on every vehicle entering the gate. Submit this form once per
              flat — we'll print and hand over at the help desk.
            </p>
          </div>
        </section>

        {prefilledFromAccount && (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-700/60 bg-emerald-900/20 px-4 py-3 text-[11px] text-emerald-200/90">
            <UserCheck size={14} className="mt-0.5 shrink-0 text-emerald-300" />
            <span>
              Signed in as{" "}
              <span className="font-semibold text-white">{user?.name}</span>{" "}
              — your details are pre-filled. Edit any field if needed.
            </span>
          </div>
        )}

        {/* Honeypot — invisible to humans, bots fill it. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-9999px",
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        >
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {/* Block + Flat */}
        <section>
          <Label>Flat</Label>
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <select
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              className={selectClasses}
              required
            >
              <option value="">Block…</option>
              <option value="1">Block 1</option>
              <option value="2">Block 2</option>
              <option value="3">Block 3</option>
              <option value="4">Block 4</option>
            </select>
            <input
              type="text"
              value={flatNumber}
              onChange={(e) => setFlatNumber(e.target.value)}
              maxLength={30}
              placeholder="e.g. 205 or 201/202"
              className={inputClasses}
              required
            />
          </div>
        </section>

        {/* Name */}
        <section>
          <Label>Full name</Label>
          <input
            type="text"
            autoComplete="name"
            value={residentName}
            onChange={(e) => setResidentName(e.target.value)}
            minLength={2}
            maxLength={80}
            placeholder="e.g. Ramesh Iyer"
            className={inputClasses}
            required
          />
        </section>

        {/* Phone */}
        <section>
          <Label>Mobile number</Label>
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile"
            className={inputClasses}
            required
          />
        </section>

        {/* Email */}
        <section>
          <Label optional>Email</Label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="optional"
            className={inputClasses}
          />
        </section>

        {/* Owner / Tenant toggle */}
        <section>
          <Label>I am the</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["OWNER", "TENANT"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setResidentType(t)}
                className={clsx(
                  "rounded-2xl border px-3 py-3 text-sm font-semibold capitalize transition-colors",
                  residentType === t
                    ? "border-indigo-400 bg-indigo-500/20 text-white"
                    : "border-slate-700 bg-slate-800/60 text-slate-300 active:bg-slate-800"
                )}
              >
                {t.toLowerCase()}
              </button>
            ))}
          </div>
        </section>

        {/* Vehicle counters */}
        <Counter
          label="4-wheelers (cars)"
          icon={Car}
          value={fourWheelers}
          onChange={setFourWheelers}
        />
        <Counter
          label="2-wheelers (bikes / scooters)"
          icon={Bike}
          value={twoWheelers}
          onChange={setTwoWheelers}
        />

        {/* Self-declaration checkboxes */}
        <section className="space-y-2">
          <Checkbox
            checked={mygateRegistered}
            onChange={setMygateRegistered}
            label="I've added all my vehicle numbers in MyGate"
            help="Helps the gate match cars to flats — see the MyGate video on the website."
          />
          <Checkbox
            checked={alreadyHasSticker}
            onChange={setAlreadyHasSticker}
            label="I've already collected my stickers"
            help="Tick this if you picked them up earlier."
          />
        </section>

        {/* Notes */}
        <section>
          <Label optional>Notes for the help desk</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Anything we should know?"
            className={textareaClasses}
          />
        </section>

        {error && (
          <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={clsx(
            "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-semibold text-white transition-colors",
            submitting
              ? "bg-slate-700"
              : "bg-indigo-500 active:bg-indigo-600"
          )}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Submit sticker request
            </>
          )}
        </button>

        <p className="pt-1 text-center text-[11px] text-slate-500">
          We'll only use these details to issue stickers and notify pickup.
        </p>
      </form>
    </div>
  );
}

// ── Reused styles & subcomponents ────────────────────────────────────────

const inputClasses =
  "w-full rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none";
const selectClasses =
  "w-full appearance-none rounded-2xl border border-slate-700 bg-slate-800/60 px-3 py-3 text-sm text-white focus:border-indigo-400 focus:outline-none";
const textareaClasses =
  "w-full resize-none rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none";

function Label({
  children,
  optional,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="mb-1.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      <span>{children}</span>
      {optional && (
        <span className="text-[10px] font-normal normal-case text-slate-600">
          optional
        </span>
      )}
    </label>
  );
}

function Counter({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: typeof Car;
  value: number;
  onChange: (n: number) => void;
}) {
  const bump = (delta: number) => onChange(Math.max(0, Math.min(10, value + delta)));
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
          <Icon size={16} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-[10px] text-slate-500">0–10 stickers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => bump(-1)}
            disabled={value === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 active:bg-slate-800 disabled:opacity-30"
          >
            <Minus size={14} />
          </button>
          <span className="w-6 text-center text-base font-bold tabular-nums text-white">
            {value}
          </span>
          <button
            type="button"
            onClick={() => bump(1)}
            disabled={value === 10}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/20 text-indigo-200 active:bg-indigo-500/30 disabled:opacity-30"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
  help?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
        checked
          ? "border-indigo-400 bg-indigo-500/15"
          : "border-slate-700 bg-slate-800/60 active:bg-slate-800"
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border",
          checked
            ? "border-indigo-400 bg-indigo-500 text-white"
            : "border-slate-600 bg-slate-900"
        )}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        {help && (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
            {help}
          </p>
        )}
      </span>
    </button>
  );
}
