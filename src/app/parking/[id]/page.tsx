"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import QRCodeLib from "qrcode";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, MapPin, IndianRupee, Clock, Car, Pencil, Trash2,
  Download, Ban, Info, Printer,
} from "lucide-react";
import { computePrice, formatDuration, monthsCeilYmd, MIN_BOOKING_MINUTES } from "@/lib/parking";

interface BusyWindow { startAt: string; endAt: string; kind: "booking" | "block"; mode?: string; ongoing?: boolean }
interface Booking {
  id: string; startAt: string; endAt: string; status: string;
  mode?: string; openEnded?: boolean; monthlyRate?: number | null;
  vehicleNumber: string | null; note: string | null;
  totalAmount: number; hourlyRate: number | null;
  bookerPaid: boolean; ownerConfirmedPaid: boolean;
  booker: { id: string; name: string; block: number | null; flatNumber: string } | null;
}
interface SlotDetail {
  id: string; label: string; location: string | null; description: string | null;
  hourlyRate: number; monthlyRate: number | null; active: boolean; payInfo: string | null; payQrUrl: string | null; photoUrl: string | null;
  owner: { id: string; name: string; block: number | null; flatNumber: string; isMe: boolean };
  busy: BusyWindow[];
  myBookings: Booking[];
  ownerBookings: Booking[] | null;
}

export default function ParkingSlotPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [slot, setSlot] = useState<SlotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/parking/slots/${id}`);
      if (!res.ok) { setError(res.status === 404 ? "Slot not found" : "Could not load"); return; }
      setSlot(await res.json());
      setError(null);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  if (loading) return <Centered><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></Centered>;
  if (error || !slot) return <Centered><div className="text-center"><p className="text-red-600 mb-3">{error ?? "Not found"}</p><Link href="/parking" className="text-blue-600 text-sm">← All parking</Link></div></Centered>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/parking" className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> All parking</Link>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Car className="text-blue-600" /> {slot.label}</h1>
            {slot.location && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 inline-flex items-center gap-1"><MapPin size={13} /> {slot.location}</p>}
          </div>
          <div className="text-right">
            <span className="inline-flex items-center font-bold text-gray-900 dark:text-gray-100 text-lg"><IndianRupee size={16} />{slot.hourlyRate}<span className="text-sm font-normal text-gray-400 dark:text-gray-500">/hr</span></span>
            {slot.monthlyRate != null && (
              <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300">₹{slot.monthlyRate}<span className="font-normal text-gray-400 dark:text-gray-500">/month</span></span>
            )}
          </div>
        </div>
        {slot.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{slot.description}</p>}
        {slot.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.photoUrl} alt={`Parking slot ${slot.label}`} className="mt-3 w-full max-h-72 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
        )}
        {!slot.owner.isMe && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Owner: {slot.owner.name} · Block {slot.owner.block ?? "—"}, {slot.owner.flatNumber}</p>}

        {/* Busy windows */}
        {slot.busy.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Already reserved</h2>
            <div className="space-y-1.5">
              {slot.busy.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <Clock size={13} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">{fmtBusy(w)}</span>
                  {w.mode === "MONTHLY" && <span className="text-xs font-medium text-purple-600 dark:text-purple-400">monthly</span>}
                  {w.kind === "block" && <span className="text-xs text-gray-400 dark:text-gray-500">(owner)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {slot.owner.isMe ? (
          <OwnerPanel slot={slot} onChange={refresh} />
        ) : (
          <BookerPanel slot={slot} onBooked={refresh} />
        )}
      </div>
    </div>
  );
}

// ── Booker view ──────────────────────────────────────────────────────────────

function BookerPanel({ slot, onBooked }: { slot: SlotDetail; onBooked: () => void }) {
  const canMonthly = slot.monthlyRate != null;
  const [mode, setMode] = useState<"HOURLY" | "MONTHLY">("HOURLY");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [mStart, setMStart] = useState(""); // monthly start date (YYYY-MM-DD)
  const [mEnd, setMEnd] = useState(""); // monthly end date (optional)
  const [vehicle, setVehicle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const price = useMemo(() => {
    if (!start || !end) return null;
    const s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
    return { amount: computePrice(slot.hourlyRate, s, e), dur: formatDuration(s, e) };
  }, [start, end, slot.hourlyRate]);

  // Monthly summary label.
  const monthly = useMemo(() => {
    if (!canMonthly || !mStart) return null;
    if (mEnd && mEnd < mStart) return { label: "End date must be after the start", invalid: true };
    const months = mEnd ? monthsCeilYmd(mStart, mEnd) : null;
    return {
      label: mEnd ? `₹${slot.monthlyRate}/month · ${months} month${months !== 1 ? "s" : ""}` : `₹${slot.monthlyRate}/month · ongoing`,
      invalid: false,
    };
  }, [canMonthly, mStart, mEnd, slot.monthlyRate]);

  async function book() {
    setErr(null);
    setBusy(true);
    try {
      const body =
        mode === "MONTHLY"
          ? { mode: "MONTHLY", startAt: mStart, endAt: mEnd || undefined, vehicleNumber: vehicle.trim() || null, note: note.trim() || null }
          : { startAt: start ? new Date(start).toISOString() : "", endAt: end ? new Date(end).toISOString() : "", vehicleNumber: vehicle.trim() || null, note: note.trim() || null };
      const res = await fetch(`/api/parking/slots/${slot.id}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setErr(d?.error ?? "Could not book"); return; }
      setDone(true);
      onBooked();
    } finally { setBusy(false); }
  }

  const activeBooking = slot.myBookings.find((b) => b.status === "BOOKED");
  const canSubmit = mode === "MONTHLY" ? !!mStart && !monthly?.invalid : !!price;

  return (
    <div className="mt-6">
      {/* Existing booking + pay info */}
      {activeBooking && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-lg p-4 mb-5">
          <p className="font-semibold text-green-800">You have this slot booked</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{bookingLine(activeBooking)}</p>
          <PayBox slot={slot} />
        </div>
      )}

      {!slot.active ? (
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 inline-flex items-center gap-2"><Info size={15} /> This slot isn&apos;t accepting bookings right now.</div>
      ) : done ? (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-lg p-4">
          <p className="font-semibold text-green-800">Booked! 🎉</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">Pay the owner to confirm, then tap “I&apos;ve paid”.</p>
          <PayBox slot={slot} />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Book this slot</h2>

          {/* Hourly / Monthly toggle (monthly only if offered) */}
          {canMonthly && (
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 text-sm">
              {(["HOURLY", "MONTHLY"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`flex-1 rounded-md py-1.5 font-medium ${mode === m ? "bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
                  {m === "HOURLY" ? "Hourly" : "Monthly"}
                </button>
              ))}
            </div>
          )}

          {mode === "HOURLY" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
                <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} min-w-0`} />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Until</label>
                <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={`${inputCls} min-w-0`} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start date</label>
                <input type="date" value={mStart} onChange={(e) => setMStart(e.target.value)} className={`${inputCls} min-w-0`} />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End date <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
                <input type="date" value={mEnd} min={mStart || undefined} onChange={(e) => setMEnd(e.target.value)} className={`${inputCls} min-w-0`} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle number <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
            <input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="KA 01 AB 1234" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. visitor for flat 302" className={inputCls} />
          </div>

          {mode === "HOURLY" && price && (
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-100 rounded-lg px-4 py-2.5">
              <span className="text-sm text-gray-600 dark:text-gray-300">{price.dur} × ₹{slot.hourlyRate}/hr</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">₹{price.amount}</span>
            </div>
          )}
          {mode === "MONTHLY" && monthly && (
            <div className={`rounded-lg px-4 py-2.5 text-sm ${monthly.invalid ? "bg-red-50 dark:bg-red-900/30 text-red-700" : "bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300"}`}>
              {monthly.label}
              {!monthly.invalid && !mEnd && <span className="block text-xs mt-0.5 text-gray-500 dark:text-gray-400">No end date → reserves the slot until you cancel.</span>}
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            {mode === "HOURLY" ? `Minimum ${MIN_BOOKING_MINUTES} minutes. ` : ""}Payment is offline — you&apos;ll see the owner&apos;s payment details after booking.
          </p>
          {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button type="button" onClick={book} disabled={busy || !canSubmit} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Booking…" : mode === "MONTHLY" ? "Book monthly" : price ? `Book for ₹${price.amount}` : "Book this slot"}
          </button>
        </div>
      )}
    </div>
  );
}

function PayBox({ slot }: { slot: SlotDetail }) {
  if (!slot.payInfo && !slot.payQrUrl) return null;
  return (
    <div className="mt-3 pt-3 border-t border-green-200">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Pay the owner</p>
      {slot.payInfo && <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{slot.payInfo}</p>}
      {slot.payQrUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slot.payQrUrl} alt="Payment QR" className="mt-2 h-44 w-44 object-contain bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2" />
      )}
    </div>
  );
}

// ── Owner view ───────────────────────────────────────────────────────────────

function OwnerPanel({ slot, onChange }: { slot: SlotDetail; onChange: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showBlock, setShowBlock] = useState(false);
  const bookingUrl = typeof window !== "undefined" ? `${window.location.origin}/parking/${slot.id}` : "";

  async function patch(bookingId: string, action: string) {
    setBusyId(bookingId);
    try {
      const res = await fetch(`/api/parking/bookings/${bookingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (res.ok) onChange();
    } finally { setBusyId(null); }
  }

  async function downloadQr() {
    try {
      const dataUrl = await QRCodeLib.toDataURL(bookingUrl, { width: 600, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `parking-${slot.label.replace(/\s+/g, "-")}.png`;
      a.click();
    } catch { /* ignore */ }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* QR */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 text-center">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Slot QR code</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 mb-3">Print this and stick it at the slot. Residents scan to book.</p>
        {bookingUrl && (
          <div className="inline-block bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <QRCodeSVG value={bookingUrl} size={180} />
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button type="button" onClick={downloadQr} className="inline-flex items-center gap-1.5 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800">
            <Download size={15} /> Download QR
          </button>
          <Link
            href={`/parking/${slot.id}/qr`}
            className="inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Printer size={15} /> Print poster
          </Link>
        </div>
      </div>

      {/* Manage */}
      <div className="flex gap-2">
        <Link href={`/parking/slots/${slot.id}/edit`} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
          <Pencil size={15} /> Edit listing
        </Link>
        <button type="button" onClick={() => setShowBlock((v) => !v)} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
          <Ban size={15} /> Block time
        </button>
      </div>

      {showBlock && <BlockForm slotId={slot.id} onDone={() => { setShowBlock(false); onChange(); }} />}

      {/* Bookings */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Bookings</h2>
        {!slot.ownerBookings || slot.ownerBookings.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No bookings yet.</p>
        ) : (
          <div className="space-y-2">
            {slot.ownerBookings.map((b) => (
              <div key={b.id} className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.mode === "MONTHLY" ? bookingLine(b) : fmtRange(b.startAt, b.endAt)}</span>
                  {b.mode !== "MONTHLY" && <span className="font-bold text-gray-900 dark:text-gray-100">₹{b.totalAmount}</span>}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{b.booker?.name} · Block {b.booker?.block ?? "—"}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}</p>
                {b.status === "BOOKED" && (
                  <div className="flex items-center gap-2 mt-2">
                    {b.ownerConfirmedPaid ? <span className="text-xs font-semibold text-green-600">Payment confirmed</span>
                      : <button type="button" onClick={() => patch(b.id, "confirm_paid")} disabled={busyId === b.id} className="text-xs font-semibold bg-green-600 text-white rounded-md px-3 py-1 hover:bg-green-700 disabled:opacity-50">{b.bookerPaid ? "Confirm payment" : "Mark received"}</button>}
                    <button type="button" onClick={() => patch(b.id, "cancel")} disabled={busyId === b.id} className="text-xs font-semibold text-red-600 hover:underline ml-auto">Cancel</button>
                  </div>
                )}
                {b.status === "CANCELLED" && <span className="text-xs text-red-600">Cancelled</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <DeleteSlot slotId={slot.id} />
    </div>
  );
}

function BlockForm({ slotId, onDone }: { slotId: string; onDone: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!start || !end) { setErr("Pick a start and end"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/parking/slots/${slotId}/blocks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), reason: reason.trim() || null }),
      });
      if (!res.ok) { setErr((await res.json().catch(() => null))?.error ?? "Could not block"); return; }
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Block a window for your own use</p>
      <div className="grid grid-cols-2 gap-3">
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={inputCls} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="button" onClick={submit} disabled={busy} className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">{busy ? "Blocking…" : "Block this time"}</button>
    </div>
  );
}

function DeleteSlot({ slotId }: { slotId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm("Remove this slot listing? Upcoming bookings will keep it paused instead of deleting.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/parking/slots/${slotId}`, { method: "DELETE" });
      if (res.ok) router.push("/parking");
    } finally { setBusy(false); }
  }
  return (
    <button type="button" onClick={del} disabled={busy} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline">
      <Trash2 size={14} /> Remove listing
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">{children}</div>;
}
const inputCls = "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso), e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  const d = s.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const st = s.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const et = e.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `${d}, ${st} – ${et}` : `${d} ${st} → ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${et}`;
}
function dateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
// Monthly endAt is an exclusive instant (midnight of the day after) → show the inclusive date.
function inclusiveEnd(endIso: string): string {
  return dateOnly(new Date(new Date(endIso).getTime() - 86_400_000).toISOString());
}
function fmtBusy(w: BusyWindow): string {
  if (w.ongoing) return `From ${dateOnly(w.startAt)} · ongoing`;
  if (w.mode === "MONTHLY") return `${dateOnly(w.startAt)} → ${inclusiveEnd(w.endAt)}`;
  return fmtRange(w.startAt, w.endAt);
}
function bookingLine(b: Booking): string {
  if (b.mode === "MONTHLY") {
    const from = dateOnly(b.startAt);
    return b.openEnded
      ? `Monthly · ₹${b.monthlyRate}/mo · from ${from} · ongoing`
      : `Monthly · ₹${b.monthlyRate}/mo · ${from} → ${inclusiveEnd(b.endAt)}`;
  }
  return `${fmtRange(b.startAt, b.endAt)} · ₹${b.totalAmount}`;
}
