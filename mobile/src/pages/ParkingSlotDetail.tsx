import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import Icon from "../components/Icon";
import { Share } from "@capacitor/share";

const MIN_BOOKING_MINUTES = 30;
const WEB_BASE = "https://onermv.app";

// Token-styled form input (OneRMV: surface-2 fill, strong border, r11, 48px).
const inputCls = "w-full rounded-[11px] px-3.5 text-[15px] outline-none";
const inputStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border-strong)",
  color: "var(--text)",
  height: 48,
} as const;
const labelCls = "mb-1.5 block text-[13px] font-semibold";
const labelStyle = { color: "var(--text-2)" } as const;

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

  if (loading) return <Centered><div className="h-7 w-7 animate-spin rounded-full border-b-2" style={{ borderColor: "var(--accent)" }} /></Centered>;
  if (error || !slot) return (
    <Centered>
      <div className="text-center">
        <p className="mb-3" style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p>
        <button onClick={() => navigate("/parking")} className="text-sm" style={{ color: "var(--accent)" }}>← All parking</button>
      </div>
    </Centered>
  );

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-6"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <button onClick={() => navigate("/parking")} className="flex items-center gap-1.5 py-3.5 text-[15px] font-semibold" style={{ color: "var(--text-2)" }}>
        <Icon name="arrow_back" size={20} style={{ color: "var(--text-2)" }} /> All parking
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
            <Icon name="directions_car" size={24} style={{ color: "var(--carblue)" }} /> {slot.label}
          </h1>
          {slot.location && (
            <p className="mt-2 flex items-start gap-1.5 text-[13px]" style={{ color: "var(--text-3)" }}>
              <Icon name="location_on" size={17} style={{ color: "var(--text-3)" }} /> {slot.location}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[16px] font-extrabold" style={{ color: "var(--text)" }}>₹{slot.hourlyRate}<span className="text-[12px]" style={{ color: "var(--text-3)" }}>/hr</span></div>
          {slot.monthlyRate != null && <div className="text-[16px] font-extrabold" style={{ color: "var(--accent)" }}>₹{slot.monthlyRate}<span className="text-[12px]" style={{ color: "var(--text-3)" }}>/mo</span></div>}
        </div>
      </div>
      {slot.description && <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--text)" }}>{slot.description}</p>}
      {slot.photoUrl ? (
        <img src={slot.photoUrl} alt={`Parking slot ${slot.label}`} className="mt-3.5 max-h-72 w-full rounded-[14px] object-cover" style={{ border: "1px solid var(--border)" }} />
      ) : null}
      {!slot.owner.isMe && <p className="mt-2 text-[12px]" style={{ color: "var(--text-3)" }}>Owner: {slot.owner.name} · B{slot.owner.block ?? "—"}, {slot.owner.flatNumber}</p>}

      {slot.busy.length > 0 && (
        <div className="mt-5">
          <Eyebrow>Already reserved</Eyebrow>
          <div className="space-y-1.5">
            {slot.busy.map((w, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-[13px] px-3.5 py-3 text-[14px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <Icon name="schedule" size={19} style={{ color: "var(--text-3)" }} />
                <span style={{ color: "var(--text)" }}>{fmtBusy(w)}</span>
                {w.mode === "MONTHLY" && <span className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>monthly</span>}
                {w.kind === "block" && <span className="text-[11px]" style={{ color: "var(--text-3)" }}>(owner)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {slot.owner.isMe ? <OwnerPanel slot={slot} onChange={refresh} navigate={navigate} token={token} /> : <BookerPanel slot={slot} onBooked={refresh} token={token} />}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="one-mono mb-2.5 text-[10px] font-medium uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>
      {children}
    </div>
  );
}

function BookerPanel({ slot, onBooked, token }: { slot: SlotDetail; onBooked: () => void; token: string | null }) {
  const canMonthly = slot.monthlyRate != null;
  const [mode, setMode] = useState<"HOURLY" | "MONTHLY">("HOURLY");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [mStart, setMStart] = useState("");
  const [mEnd, setMEnd] = useState("");
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
      const res = await apiFetch(`/api/parking/slots/${slot.id}/bookings`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      if (!res.ok) { setErr(await readError(res)); return; }
      setDone(true);
      onBooked();
    } finally {
      setBusy(false);
    }
  }

  const activeBooking = slot.myBookings.find((b) => b.status === "BOOKED");
  const canSubmit = mode === "MONTHLY" ? !!mStart && !monthly?.invalid : !!price;

  return (
    <div className="mt-6">
      {activeBooking && (
        <div className="mb-5 rounded-[18px] p-[18px]" style={{ background: "var(--success-soft)", border: "1px solid var(--success-line)" }}>
          <div className="flex items-center gap-2">
            <Icon name="check_circle" size={22} fill style={{ color: "var(--success)" }} />
            <p className="text-[18px] font-extrabold" style={{ color: "var(--success)" }}>You have this slot booked</p>
          </div>
          <p className="mt-1.5 text-[14px]" style={{ color: "var(--text)" }}>{bookingLine(activeBooking)}</p>
          <PayBox slot={slot} />
        </div>
      )}

      {!slot.active ? (
        <div className="flex items-center gap-2 rounded-[18px] p-4 text-[14px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)" }}>
          <Icon name="info" size={18} style={{ color: "var(--text-3)" }} /> This slot isn&apos;t accepting bookings right now.
        </div>
      ) : done ? (
        <div className="rounded-[18px] p-[18px]" style={{ background: "var(--success-soft)", border: "1px solid var(--success-line)" }}>
          <div className="flex items-center gap-2">
            <Icon name="check_circle" size={22} fill style={{ color: "var(--success)" }} />
            <p className="text-[18px] font-extrabold" style={{ color: "var(--success)" }}>You have this slot booked</p>
          </div>
          <p className="mt-1.5 text-[14px]" style={{ color: "var(--text)" }}>Pay the owner to confirm, then tap “I&apos;ve paid”.</p>
          <PayBox slot={slot} />
        </div>
      ) : (
        <div className="rounded-[18px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-[18px] font-extrabold" style={{ color: "var(--text)" }}>Book this slot</h2>

          {canMonthly && (
            <div className="mt-3.5 flex rounded-[12px] p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {(["HOURLY", "MONTHLY"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className="flex-1 rounded-[9px] py-2.5 text-[14px] font-bold"
                  style={mode === m ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 5px rgba(0,0,0,0.18)" } : { background: "transparent", color: "var(--text-3)" }}>
                  {m === "HOURLY" ? "Hourly" : "Monthly"}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-3.5">
            {mode === "HOURLY" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={labelStyle}>From</label>
                  <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} min-w-0 appearance-none`} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Until</label>
                  <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={`${inputCls} min-w-0 appearance-none`} style={inputStyle} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={labelStyle}>Start date</label>
                  <input type="date" value={mStart} onChange={(e) => setMStart(e.target.value)} className={`${inputCls} min-w-0 appearance-none`} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>End (optional)</label>
                  <input type="date" value={mEnd} min={mStart || undefined} onChange={(e) => setMEnd(e.target.value)} className={`${inputCls} min-w-0 appearance-none`} style={inputStyle} />
                </div>
              </div>
            )}

            <div>
              <label className={labelCls} style={labelStyle}>Vehicle number (optional)</label>
              <input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="KA 01 AB 1234" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Note (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="visitor for flat 302" className={inputCls} style={inputStyle} />
            </div>

            {mode === "HOURLY" && price && (
              <div className="flex items-center justify-between rounded-[11px] px-3.5 py-2.5" style={{ background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                <span className="text-[13px]" style={{ color: "var(--text-2)" }}>{price.dur} × ₹{slot.hourlyRate}/hr</span>
                <span className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>₹{price.amount}</span>
              </div>
            )}
            {mode === "MONTHLY" && monthly && (
              <div className="rounded-[11px] px-3.5 py-2.5 text-[13px]" style={monthly.invalid
                ? { background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }
                : { background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", color: "var(--accent)" }}>
                {monthly.label}
                {!monthly.invalid && !mEnd && <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-3)" }}>No end date → reserves the slot until you cancel.</span>}
              </div>
            )}

            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>{mode === "HOURLY" ? `Minimum ${MIN_BOOKING_MINUTES} min. ` : ""}Payment is offline — you&apos;ll see the owner&apos;s details after booking.</p>
            {err && <p className="rounded-[11px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}>{err}</p>}
            <button onClick={book} disabled={busy || !canSubmit} className="w-full rounded-[13px] py-3.5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>
              {busy ? "Booking…" : mode === "MONTHLY" ? "Book monthly" : price ? `Book for ₹${price.amount}` : "Book this slot"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PayBox({ slot }: { slot: SlotDetail }) {
  if (!slot.payInfo && !slot.payQrUrl) return null;
  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--success-line)" }}>
      <div className="one-mono text-[10px] font-medium uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>Pay the owner</div>
      {slot.payInfo && <p className="mt-1.5 text-[16px] font-bold" style={{ color: "var(--text)" }}>{slot.payInfo}</p>}
      {slot.payQrUrl && <img src={slot.payQrUrl} alt="Payment QR" className="mt-3 h-[150px] w-[150px] rounded-[14px] bg-white object-contain p-2" />}
    </div>
  );
}

// WhatsApp-ready listing blurb. Mirrored in src/app/parking/[id]/page.tsx.
function buildShareText(slot: SlotDetail, url: string): string {
  const rate = `💰 ₹${slot.hourlyRate}/hr${slot.monthlyRate != null ? ` · ₹${slot.monthlyRate}/month` : ""}`;
  return [
    `🅿️ Parking slot available — ${slot.label}`,
    slot.location ? `📍 ${slot.location}` : null,
    rate,
    slot.description ? `📝 ${slot.description}` : null,
    `By ${slot.owner.name} · Block ${slot.owner.block ?? "—"}, ${slot.owner.flatNumber}`,
    "",
    "Book it here (RMV residents):",
    url,
  ]
    .filter((l) => l !== null)
    .join("\n");
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

  async function shareSlot() {
    try {
      await Share.share({
        title: slot.label,
        text: buildShareText(slot, bookingUrl),
        dialogTitle: "Share parking slot",
      });
    } catch {
      // user cancelled or share sheet unavailable — no-op
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-[18px] p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-[16px] font-bold" style={{ color: "var(--text)" }}>Slot QR code</h2>
        <p className="mb-3 mt-1 text-[13px]" style={{ color: "var(--text-3)" }}>Print this and stick it at the slot. Residents scan to book.</p>
        <div className="inline-block rounded-[12px] bg-white p-3">
          <QRCodeSVG value={bookingUrl} size={170} />
        </div>
        <p className="mt-3 break-all text-[10px]" style={{ color: "var(--text-3)" }}>{bookingUrl}</p>
        <button onClick={() => void shareSlot()} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-[12px] px-4 py-2.5 text-[14px] font-bold text-white active:opacity-90" style={{ background: "var(--success)" }}>
          <Icon name="share" size={16} style={{ color: "#fff" }} /> Share on WhatsApp
        </button>
      </div>

      <div className="flex gap-2.5">
        <button onClick={() => navigate(`/parking/slots/${slot.id}/edit`)} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[13px] font-semibold active:opacity-80" style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}>
          <Icon name="edit" size={16} style={{ color: "var(--text)" }} /> Edit
        </button>
        <button onClick={() => setShowBlock((v) => !v)} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[13px] font-semibold active:opacity-80" style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}>
          <Icon name="block" size={16} style={{ color: "var(--text)" }} /> Block time
        </button>
      </div>

      {showBlock && <BlockForm slotId={slot.id} token={token} onDone={() => { setShowBlock(false); onChange(); }} />}

      <div>
        <Eyebrow>Bookings</Eyebrow>
        {!slot.ownerBookings || slot.ownerBookings.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--text-3)" }}>No bookings yet.</p>
        ) : (
          <div className="space-y-2.5">
            {slot.ownerBookings.map((b) => (
              <div key={b.id} className="rounded-[16px] p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: b.status === "CANCELLED" ? 0.6 : 1 }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>{b.mode === "MONTHLY" ? bookingLine(b) : fmtRange(b.startAt, b.endAt)}</span>
                  {b.mode !== "MONTHLY" && <span className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>₹{b.totalAmount}</span>}
                </div>
                <p className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>{b.booker?.name} · B{b.booker?.block ?? "—"}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}</p>
                {b.status === "BOOKED" && (
                  <div className="mt-2.5 flex items-center gap-2">
                    {b.ownerConfirmedPaid ? <span className="text-[11px] font-bold" style={{ color: "var(--success)" }}>Payment confirmed</span>
                      : <button onClick={() => patch(b.id, "confirm_paid")} disabled={busyId === b.id} className="rounded-full px-3 py-1 text-[11px] font-bold text-white active:opacity-90" style={{ background: "var(--success)" }}>{b.bookerPaid ? "Confirm payment" : "Mark received"}</button>}
                    <button onClick={() => patch(b.id, "cancel")} disabled={busyId === b.id} className="ml-auto text-[11px] font-bold" style={{ color: "var(--danger)" }}>Cancel</button>
                  </div>
                )}
                {b.status === "CANCELLED" && <span className="text-[11px]" style={{ color: "var(--danger)" }}>Cancelled</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={del} className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "var(--danger)" }}><Icon name="delete" size={16} style={{ color: "var(--danger)" }} /> Remove listing</button>
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
    <div className="space-y-3 rounded-[16px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>Block a window for your own use</p>
      <div className="grid grid-cols-2 gap-2.5">
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} style={inputStyle} />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} style={inputStyle} />
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={inputCls} style={inputStyle} />
      {err && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{err}</p>}
      <button onClick={submit} disabled={busy} className="w-full rounded-[12px] py-2.5 text-[13px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>{busy ? "Blocking…" : "Block this time"}</button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="one-surface flex flex-1 items-center justify-center px-4" style={{ background: "var(--bg)", color: "var(--text)" }}>{children}</div>;
}
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
function dateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
// Monthly endAt is exclusive (midnight of the day after) → show the inclusive date.
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
// Whole months rounded up (mirror src/lib/parking monthsCeilYmd).
function monthsCeilYmd(startYmd: string, endYmd: string): number {
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  let months = (ey - sy) * 12 + (em - sm);
  if (ed >= sd) months += 1;
  return Math.max(1, months);
}
