import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import {
  ArrowLeft, MapPin, IndianRupee, Clock, Car, Pencil, Trash2, Ban, Info,
} from "lucide-react";

const MIN_BOOKING_MINUTES = 30;
const WEB_BASE = "https://onermv.app";

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

async function readError(res: Response): Promise<string> {
  const e = await res.json().catch(() => null);
  return e?.error ?? `Request failed (${res.status})`;
}

export default function ParkingSlotDetail() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [slot, setSlot] = useState<SlotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/parking/slots/${id}`, { token });
      if (!res.ok) { setError(res.status === 404 ? "Slot not found" : "Could not load"); return; }
      setSlot(await res.json());
      setError(null);
    } catch {
      setError("Could not load");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  if (loading) return <Centered><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-400" /></Centered>;
  if (error || !slot) return (
    <Centered>
      <div className="text-center">
        <p className="mb-3 text-red-400">{error ?? "Not found"}</p>
        <button onClick={() => navigate("/parking")} className="text-sm text-blue-400">← All parking</button>
      </div>
    </Centered>
  );

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
      <button onClick={() => navigate("/parking")} className="flex items-center gap-1 py-4 text-sm text-slate-400">
        <ArrowLeft size={16} /> All parking
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white"><Car className="text-blue-400" size={20} /> {slot.label}</h1>
          {slot.location && <p className="mt-1 flex items-center gap-1 text-sm text-slate-400"><MapPin size={13} /> {slot.location}</p>}
        </div>
        <span className="flex items-center text-lg font-bold text-white"><IndianRupee size={15} />{slot.hourlyRate}<span className="text-sm font-normal text-slate-500">/hr</span></span>
      </div>
      {slot.description && <p className="mt-2 text-sm text-slate-300">{slot.description}</p>}
      {!slot.owner.isMe && <p className="mt-1 text-[11px] text-slate-500">Owner: {slot.owner.name} · B{slot.owner.block ?? "—"}, {slot.owner.flatNumber}</p>}

      {slot.busy.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Already reserved</h2>
          <div className="space-y-1.5">
            {slot.busy.map((w, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-[12px]">
                <Clock size={12} className="text-slate-500" />
                <span className="text-slate-300">{fmtRange(w.startAt, w.endAt)}</span>
                {w.kind === "block" && <span className="text-[10px] text-slate-500">(owner)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {slot.owner.isMe ? <OwnerPanel slot={slot} onChange={refresh} navigate={navigate} token={token} /> : <BookerPanel slot={slot} onBooked={refresh} token={token} />}
    </div>
  );
}

function BookerPanel({ slot, onBooked, token }: { slot: SlotDetail; onBooked: () => void; token: string | null }) {
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
      const res = await apiFetch(`/api/parking/slots/${slot.id}/bookings`, {
        method: "POST",
        token,
        body: JSON.stringify({
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          vehicleNumber: vehicle.trim() || null,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) { setErr(await readError(res)); return; }
      setDone(true);
      onBooked();
    } finally {
      setBusy(false);
    }
  }

  const activeBooking = slot.myBookings.find((b) => b.status === "BOOKED");

  return (
    <div className="mt-6">
      {activeBooking && (
        <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="font-semibold text-emerald-300">You have this slot booked</p>
          <p className="mt-0.5 text-sm text-slate-300">{fmtRange(activeBooking.startAt, activeBooking.endAt)} · ₹{activeBooking.totalAmount}</p>
          <PayBox slot={slot} />
        </div>
      )}

      {!slot.active ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-400"><Info size={15} /> This slot isn&apos;t accepting bookings right now.</div>
      ) : done ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="font-semibold text-emerald-300">Booked! 🎉</p>
          <p className="mt-0.5 text-sm text-slate-300">Pay the owner to confirm, then tap “I&apos;ve paid”.</p>
          <PayBox slot={slot} />
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
          <h2 className="font-semibold text-white">Book this slot</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">From</label>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Until</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Vehicle number (optional)</label>
            <input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="KA 01 AB 1234" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="visitor for flat 302" className={inputCls} />
          </div>
          {price && (
            <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
              <span className="text-[12px] text-slate-300">{price.dur} × ₹{slot.hourlyRate}/hr</span>
              <span className="font-bold text-white">₹{price.amount}</span>
            </div>
          )}
          <p className="text-[11px] text-slate-500">Minimum {MIN_BOOKING_MINUTES} min. Payment is offline — you&apos;ll see the owner&apos;s details after booking.</p>
          {err && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-[12px] text-red-200">{err}</p>}
          <button onClick={book} disabled={busy || !price} className="w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white active:bg-indigo-600 disabled:opacity-50">
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
    <div className="mt-3 border-t border-emerald-500/20 pt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pay the owner</p>
      {slot.payInfo && <p className="text-sm font-medium text-white">{slot.payInfo}</p>}
      {slot.payQrUrl && <img src={slot.payQrUrl} alt="Payment QR" className="mt-2 h-44 w-44 rounded-lg bg-white object-contain p-2" />}
    </div>
  );
}

function OwnerPanel({ slot, onChange, navigate, token }: { slot: SlotDetail; onChange: () => void; navigate: (p: string) => void; token: string | null }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showBlock, setShowBlock] = useState(false);
  const bookingUrl = `${WEB_BASE}/parking/${slot.id}`;

  async function patch(bookingId: string, action: string) {
    setBusyId(bookingId);
    try {
      const res = await apiFetch(`/api/parking/bookings/${bookingId}`, { method: "PATCH", token, body: JSON.stringify({ action }) });
      if (res.ok) onChange();
    } finally {
      setBusyId(null);
    }
  }

  async function del() {
    if (!confirm("Remove this slot listing? Upcoming bookings will keep it paused instead of deleting.")) return;
    const res = await apiFetch(`/api/parking/slots/${slot.id}`, { method: "DELETE", token });
    if (res.ok) navigate("/parking");
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 text-center">
        <h2 className="font-semibold text-white">Slot QR code</h2>
        <p className="mb-3 mt-0.5 text-sm text-slate-400">Print this and stick it at the slot. Residents scan to book.</p>
        <div className="inline-block rounded-lg bg-white p-3">
          <QRCodeSVG value={bookingUrl} size={170} />
        </div>
        <p className="mt-3 break-all text-[10px] text-slate-500">{bookingUrl}</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => navigate(`/parking/slots/${slot.id}/edit`)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-[12px] font-medium text-slate-200 active:bg-slate-800">
          <Pencil size={14} /> Edit
        </button>
        <button onClick={() => setShowBlock((v) => !v)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-[12px] font-medium text-slate-200 active:bg-slate-800">
          <Ban size={14} /> Block time
        </button>
      </div>

      {showBlock && <BlockForm slotId={slot.id} token={token} onDone={() => { setShowBlock(false); onChange(); }} />}

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bookings</h2>
        {!slot.ownerBookings || slot.ownerBookings.length === 0 ? (
          <p className="text-sm text-slate-500">No bookings yet.</p>
        ) : (
          <div className="space-y-2">
            {slot.ownerBookings.map((b) => (
              <div key={b.id} className={`rounded-2xl border border-slate-700 bg-slate-800/60 p-3 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{fmtRange(b.startAt, b.endAt)}</span>
                  <span className="font-bold text-white">₹{b.totalAmount}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">{b.booker?.name} · B{b.booker?.block ?? "—"}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}</p>
                {b.status === "BOOKED" && (
                  <div className="mt-2 flex items-center gap-2">
                    {b.ownerConfirmedPaid ? <span className="text-[10px] font-bold text-emerald-300">Payment confirmed</span>
                      : <button onClick={() => patch(b.id, "confirm_paid")} disabled={busyId === b.id} className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white active:bg-emerald-600">{b.bookerPaid ? "Confirm payment" : "Mark received"}</button>}
                    <button onClick={() => patch(b.id, "cancel")} disabled={busyId === b.id} className="ml-auto text-[10px] font-bold text-red-300">Cancel</button>
                  </div>
                )}
                {b.status === "CANCELLED" && <span className="text-[10px] text-red-300">Cancelled</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={del} className="flex items-center gap-1.5 text-sm text-red-300"><Trash2 size={14} /> Remove listing</button>
    </div>
  );
}

function BlockForm({ slotId, token, onDone }: { slotId: string; token: string | null; onDone: () => void }) {
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
      const res = await apiFetch(`/api/parking/slots/${slotId}/blocks`, {
        method: "POST",
        token,
        body: JSON.stringify({ startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), reason: reason.trim() || null }),
      });
      if (!res.ok) { setErr(await readError(res)); return; }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
      <p className="text-sm font-medium text-slate-200">Block a window for your own use</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={inputCls} />
      {err && <p className="text-[12px] text-red-300">{err}</p>}
      <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-slate-700 py-2 text-[12px] font-medium text-white active:bg-slate-600 disabled:opacity-50">{busy ? "Blocking…" : "Block this time"}</button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center px-4">{children}</div>;
}
const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none";
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
