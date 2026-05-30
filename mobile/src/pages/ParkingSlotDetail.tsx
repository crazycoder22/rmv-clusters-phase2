import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../lib/api";
import {
  ArrowLeft, MapPin, IndianRupee, Clock, Car, Pencil, Trash2, Ban, Info,
} from "lucide-react";

const MIN_BOOKING_MINUTES = 30;

interface BusyWindow { startAt: string; endAt: string; kind: "booking" | "block" }
interface Booking {
  id: string; startAt: string; endAt: string; status: string;
  vehicleNumber: string | null; note: string | null;
  totalAmount: number; hourlyRate: number;
  bookerPaid: boolean; ownerConfirmedPaid: boolean;
  booker: { id: string; name: string; block: number | null; flatNumber: string } | null;
}
interface SlotDetail {
  id: string; label: string; location: string | null; description: string | null;
  hourlyRate: number; active: boolean; payInfo: string | null; payQrUrl: string | null;
  owner: { id: string; name: string; block: number | null; flatNumber: string; isMe: boolean };
  busy: BusyWindow[];
  myBookings: Booking[];
  ownerBookings: Booking[] | null;
}

const WEB_BASE = "https://onermv.app";

export default function ParkingSlotDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [slot, setSlot] = useState<SlotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api<SlotDetail>(`/api/parking/slots/${id}`);
      setSlot(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  if (loading) return <Centered><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400" /></Centered>;
  if (error || !slot) return (
    <Centered>
      <div className="text-center">
        <p className="text-red-400 mb-3">{error ?? "Not found"}</p>
        <button onClick={() => navigate("/parking")} className="text-blue-400 text-sm">← All parking</button>
      </div>
    </Centered>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="px-4 padding-safe-top">
        <button onClick={() => navigate("/parking")} className="flex items-center gap-1 text-sm text-slate-400 pt-4 pb-2">
          <ArrowLeft size={16} /> All parking
        </button>

        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Car className="text-blue-400" size={22} /> {slot.label}</h1>
            {slot.location && <p className="text-sm text-slate-400 mt-1 flex items-center gap-1"><MapPin size={13} /> {slot.location}</p>}
          </div>
          <span className="flex items-center font-bold text-lg"><IndianRupee size={16} />{slot.hourlyRate}<span className="text-sm font-normal text-slate-500">/hr</span></span>
        </div>
        {slot.description && <p className="text-sm text-slate-300 mt-2">{slot.description}</p>}
        {!slot.owner.isMe && <p className="text-xs text-slate-500 mt-1">Owner: {slot.owner.name} · Block {slot.owner.block ?? "—"}, {slot.owner.flatNumber}</p>}

        {slot.busy.length > 0 && (
          <div className="mt-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Already reserved</h2>
            <div className="space-y-1.5">
              {slot.busy.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                  <Clock size={13} className="text-slate-500" />
                  <span className="text-slate-300">{fmtRange(w.startAt, w.endAt)}</span>
                  {w.kind === "block" && <span className="text-xs text-slate-500">(owner)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {slot.owner.isMe ? <OwnerPanel slot={slot} onChange={refresh} navigate={navigate} /> : <BookerPanel slot={slot} onBooked={refresh} />}
      </div>
    </div>
  );
}

function BookerPanel({ slot, onBooked }: { slot: SlotDetail; onBooked: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const price = useMemo(() => {
    if (!start || !end) return null;
    const s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
    const hours = (e.getTime() - s.getTime()) / 3_600_000;
    return { amount: Math.round(slot.hourlyRate * hours * 100) / 100, dur: fmtDur(s, e) };
  }, [start, end, slot.hourlyRate]);

  async function book() {
    setErr(null);
    if (!start || !end) { setErr("Pick a start and end time"); return; }
    setBusy(true);
    try {
      await api(`/api/parking/slots/${slot.id}/bookings`, {
        method: "POST",
        body: {
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          vehicleNumber: vehicle.trim() || null,
          note: note.trim() || null,
        },
      });
      setDone(true);
      onBooked();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not book");
    } finally {
      setBusy(false);
    }
  }

  const activeBooking = slot.myBookings.find((b) => b.status === "BOOKED");

  return (
    <div className="mt-6">
      {activeBooking && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-5">
          <p className="font-semibold text-green-300">You have this slot booked</p>
          <p className="text-sm text-slate-300 mt-0.5">{fmtRange(activeBooking.startAt, activeBooking.endAt)} · ₹{activeBooking.totalAmount}</p>
          <PayBox slot={slot} />
        </div>
      )}

      {!slot.active ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-400 flex items-center gap-2"><Info size={15} /> This slot isn&apos;t accepting bookings right now.</div>
      ) : done ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="font-semibold text-green-300">Booked! 🎉</p>
          <p className="text-sm text-slate-300 mt-0.5">Pay the owner to confirm, then tap “I&apos;ve paid”.</p>
          <PayBox slot={slot} />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">Book this slot</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">From</label>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Until</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Vehicle number (optional)</label>
            <input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="KA 01 AB 1234" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="visitor for flat 302" className={inputCls} />
          </div>
          {price && (
            <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
              <span className="text-sm text-slate-300">{price.dur} × ₹{slot.hourlyRate}/hr</span>
              <span className="font-bold">₹{price.amount}</span>
            </div>
          )}
          <p className="text-xs text-slate-500">Minimum {MIN_BOOKING_MINUTES} min. Payment is offline — you&apos;ll see the owner&apos;s details after booking.</p>
          {err && <p className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button onClick={book} disabled={busy || !price} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
            {busy ? "Booking…" : price ? `Book for ₹${price.amount}` : "Book this slot"}
          </button>
        </div>
      )}
    </div>
  );
}

function PayBox({ slot }: { slot: SlotDetail }) {
  if (!slot.payInfo && !slot.payQrUrl) return null;
  return (
    <div className="mt-3 pt-3 border-t border-green-500/20">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Pay the owner</p>
      {slot.payInfo && <p className="text-sm font-medium">{slot.payInfo}</p>}
      {slot.payQrUrl && <img src={slot.payQrUrl} alt="Payment QR" className="mt-2 h-44 w-44 object-contain bg-white rounded-lg p-2" />}
    </div>
  );
}

function OwnerPanel({ slot, onChange, navigate }: { slot: SlotDetail; onChange: () => void; navigate: (p: string) => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showBlock, setShowBlock] = useState(false);
  const bookingUrl = `${WEB_BASE}/parking/${slot.id}`;

  async function patch(bookingId: string, action: string) {
    setBusyId(bookingId);
    try {
      await api(`/api/parking/bookings/${bookingId}`, { method: "PATCH", body: { action } });
      onChange();
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  }

  async function del() {
    if (!confirm("Remove this slot listing? Upcoming bookings will keep it paused instead of deleting.")) return;
    try {
      await api(`/api/parking/slots/${slot.id}`, { method: "DELETE" });
      navigate("/parking");
    } catch {
      // ignore
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
        <h2 className="font-semibold">Slot QR code</h2>
        <p className="text-sm text-slate-400 mt-0.5 mb-3">Print this and stick it at the slot. Residents scan to book.</p>
        <div className="inline-block bg-white p-3 rounded-lg">
          <QRCodeSVG value={bookingUrl} size={170} />
        </div>
        <p className="text-xs text-slate-500 mt-3 break-all">{bookingUrl}</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => navigate(`/parking/slots/${slot.id}/edit`)} className="flex-1 flex items-center justify-center gap-1.5 border border-slate-700 text-slate-200 rounded-lg py-2 text-sm font-medium">
          <Pencil size={15} /> Edit
        </button>
        <button onClick={() => setShowBlock((v) => !v)} className="flex-1 flex items-center justify-center gap-1.5 border border-slate-700 text-slate-200 rounded-lg py-2 text-sm font-medium">
          <Ban size={15} /> Block time
        </button>
      </div>

      {showBlock && <BlockForm slotId={slot.id} onDone={() => { setShowBlock(false); onChange(); }} />}

      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Bookings</h2>
        {!slot.ownerBookings || slot.ownerBookings.length === 0 ? (
          <p className="text-sm text-slate-500">No bookings yet.</p>
        ) : (
          <div className="space-y-2">
            {slot.ownerBookings.map((b) => (
              <div key={b.id} className={`bg-slate-900 border border-slate-800 rounded-xl p-3 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{fmtRange(b.startAt, b.endAt)}</span>
                  <span className="font-bold">₹{b.totalAmount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{b.booker?.name} · Block {b.booker?.block ?? "—"}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}</p>
                {b.status === "BOOKED" && (
                  <div className="flex items-center gap-2 mt-2">
                    {b.ownerConfirmedPaid ? <span className="text-xs font-semibold text-green-400">Payment confirmed</span>
                      : <button onClick={() => patch(b.id, "confirm_paid")} disabled={busyId === b.id} className="text-xs font-semibold bg-green-600 text-white rounded-md px-3 py-1">{b.bookerPaid ? "Confirm payment" : "Mark received"}</button>}
                    <button onClick={() => patch(b.id, "cancel")} disabled={busyId === b.id} className="text-xs font-semibold text-red-400 ml-auto">Cancel</button>
                  </div>
                )}
                {b.status === "CANCELLED" && <span className="text-xs text-red-400">Cancelled</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={del} className="flex items-center gap-1.5 text-sm text-red-400"><Trash2 size={14} /> Remove listing</button>
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
      await api(`/api/parking/slots/${slotId}/blocks`, {
        method: "POST",
        body: { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), reason: reason.trim() || null },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not block");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-slate-200">Block a window for your own use</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={inputCls} />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button onClick={submit} disabled={busy} className="w-full bg-slate-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">{busy ? "Blocking…" : "Block this time"}</button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center">{children}</div>;
}
const inputCls = "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none";
function fmtDur(s: Date, e: Date): string {
  const m = Math.round((e.getTime() - s.getTime()) / 60000);
  const h = Math.floor(m / 60), mm = m % 60;
  if (h && mm) return `${h}h ${mm}m`;
  if (h) return `${h}h`;
  return `${mm}m`;
}
function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso), e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  const d = s.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const st = s.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const et = e.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `${d}, ${st} – ${et}` : `${d} ${st} → ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${et}`;
}
