import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import Icon from "../components/Icon";

type Tab = "find" | "slots" | "bookings";

interface SlotCard {
  id: string;
  label: string;
  location: string | null;
  description: string | null;
  hourlyRate: number;
  monthlyRate: number | null;
  active: boolean;
  photoUrl: string | null;
  hasPayInfo: boolean;
  owner: { id: string; name: string; block: number | null; flatNumber: string; isMe: boolean };
  busyNow: boolean;
  busyUntil: string | null;
  busyOngoing?: boolean;
  upcomingCount: number;
}
interface BookerBooking {
  id: string;
  slotId: string;
  slotLabel: string;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
  mode?: string;
  openEnded?: boolean;
  monthlyRate?: number | null;
  vehicleNumber: string | null;
  totalAmount: number;
  bookerPaid: boolean;
  ownerConfirmedPaid: boolean;
}
interface OwnerBooking {
  id: string;
  slotId: string;
  slotLabel: string;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
  mode?: string;
  openEnded?: boolean;
  monthlyRate?: number | null;
  vehicleNumber: string | null;
  totalAmount: number;
  bookerPaid: boolean;
  ownerConfirmedPaid: boolean;
  booker: { name: string; block: number | null; flatNumber: string };
}

// Striped "slot photo" placeholder matching the design when a slot has no photo.
const stripe =
  "repeating-linear-gradient(135deg,var(--surface-2) 0,var(--surface-2) 12px,var(--surface-3) 12px,var(--surface-3) 24px)";

export default function Parking() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("find");
  const [browse, setBrowse] = useState<SlotCard[]>([]);
  const [mine, setMine] = useState<SlotCard[]>([]);
  const [asBooker, setAsBooker] = useState<BookerBooking[]>([]);
  const [asOwner, setAsOwner] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [b, m, bk] = await Promise.all([
        apiFetch("/api/parking/slots", { token }),
        apiFetch("/api/parking/slots?mine=owner", { token }),
        apiFetch("/api/parking/bookings", { token }),
      ]);
      if (b.ok) setBrowse((await b.json()).slots ?? []);
      if (m.ok) setMine((await m.json()).slots ?? []);
      if (bk.ok) {
        const d = await bk.json();
        setAsBooker(d.asBooker ?? []);
        setAsOwner(d.asOwner ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function patchBooking(id: string, action: string) {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/parking/bookings/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => navigate("/community")} className="flex active:opacity-70" aria-label="Back">
            <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
          </button>
          <Icon name="directions_car" size={26} weight={500} style={{ color: "var(--carblue)" }} />
          <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
            Parking
          </h1>
        </div>
        {tab === "slots" && (
          <button
            type="button"
            onClick={() => navigate("/parking/slots/new")}
            className="flex items-center gap-1 rounded-full px-4 py-2 text-[14px] font-bold text-white active:opacity-90"
            style={{ background: "var(--accent-strong)" }}
          >
            <Icon name="add" size={18} style={{ color: "#fff" }} /> List
          </button>
        )}
      </header>

      <div
        className="mb-3.5 flex rounded-[14px] p-1"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <TabBtn active={tab === "find"} onClick={() => setTab("find")}>Find</TabBtn>
        <TabBtn active={tab === "slots"} onClick={() => setTab("slots")}>My slots</TabBtn>
        <TabBtn active={tab === "bookings"} onClick={() => setTab("bookings")}>My bookings</TabBtn>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div
            className="h-7 w-7 animate-spin rounded-full border-b-2"
            style={{ borderColor: "var(--accent)" }}
          />
        </div>
      ) : (
        <div className="flex-1 pb-4">
          {tab === "find" &&
            (browse.length === 0 ? (
              <Empty text="No slots listed right now. Check back later." />
            ) : (
              <div className="space-y-3">
                {browse.map((s) => (
                  <SlotCardView key={s.id} slot={s} onClick={() => navigate(`/parking/${s.id}`)} />
                ))}
                <p className="pt-1 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
                  {browse.length} slot{browse.length !== 1 ? "s" : ""} available
                </p>
              </div>
            ))}

          {tab === "slots" &&
            (mine.length === 0 ? (
              <Empty text="You haven't listed a slot yet. Tap “List” to share yours." />
            ) : (
              <div className="space-y-3">
                {mine.map((s) => (
                  <SlotCardView key={s.id} slot={s} ownerView onClick={() => navigate(`/parking/${s.id}`)} />
                ))}
                <p className="pt-1 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
                  Tap “List” to add another slot
                </p>
              </div>
            ))}

          {tab === "bookings" && (
            <div className="space-y-6">
              <div>
                <Eyebrow>Slots I booked</Eyebrow>
                {asBooker.length === 0 ? (
                  <Empty text="No bookings yet." />
                ) : (
                  <div className="space-y-2.5">
                    {asBooker.map((b) => (
                      <BookerRow key={b.id} b={b} busy={busyId === b.id}
                        onOpen={() => navigate(`/parking/${b.slotId}`)}
                        onPay={() => patchBooking(b.id, "claim_paid")}
                        onCancel={() => patchBooking(b.id, "cancel")} />
                    ))}
                  </div>
                )}
              </div>

              {asOwner.length > 0 && (
                <div>
                  <Eyebrow>Bookings on my slots</Eyebrow>
                  <div className="space-y-2.5">
                    {asOwner.map((b) => (
                      <OwnerRow key={b.id} b={b} busy={busyId === b.id}
                        onOpen={() => navigate(`/parking/${b.slotId}`)}
                        onConfirm={() => patchBooking(b.id, "confirm_paid")}
                        onCancel={() => patchBooking(b.id, "cancel")} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-[10px] py-2.5 text-[14px] font-bold transition-colors"
      style={
        active
          ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 5px rgba(0,0,0,0.18)" }
          : { background: "transparent", color: "var(--text-3)" }
      }
    >
      {children}
    </button>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="one-mono mb-2.5 text-[10px] font-medium uppercase"
      style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}
    >
      {children}
    </div>
  );
}

// Slot card — striped photo (or real photo), name + status badge, location,
// hourly/monthly rates + owner. Matches the design's Find / My slots card.
function SlotCardView({ slot, ownerView, onClick }: { slot: SlotCard; ownerView?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full overflow-hidden rounded-[18px] text-left active:opacity-90"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {slot.photoUrl ? (
        <img src={slot.photoUrl} alt="" className="h-[140px] w-full object-cover" />
      ) : (
        <div
          className="flex h-[140px] items-center justify-center"
          style={{ backgroundImage: stripe }}
        >
          <span
            className="one-mono rounded-[7px] px-2.5 py-1 text-[11px]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}
          >
            slot photo
          </span>
        </div>
      )}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[17px] font-bold" style={{ color: "var(--text)" }}>{slot.label}</h3>
          {ownerView ? (
            <SlotBadge tone={slot.active ? "success" : "muted"}>{slot.active ? "Listed" : "Paused"}</SlotBadge>
          ) : slot.busyOngoing ? (
            <SlotBadge tone="accent">Rented monthly</SlotBadge>
          ) : slot.busyNow ? (
            <SlotBadge tone="warning">Busy now</SlotBadge>
          ) : (
            <SlotBadge tone="success">Free</SlotBadge>
          )}
        </div>
        {slot.location && (
          <div className="mt-1.5 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
            <Icon name="location_on" size={16} style={{ color: "var(--text-3)" }} />
            <span className="truncate text-[13px]">{slot.location}</span>
          </div>
        )}
        <div className="mt-2.5 flex items-center gap-3">
          <span className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
            ₹{slot.hourlyRate}
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>/hr</span>
          </span>
          {slot.monthlyRate != null && (
            <span className="text-[15px] font-extrabold" style={{ color: "var(--accent)" }}>
              ₹{slot.monthlyRate}
              <span className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>/mo</span>
            </span>
          )}
          {!ownerView && (
            <span className="ml-auto text-[12px]" style={{ color: "var(--text-3)" }}>
              {slot.owner.name} · B{slot.owner.block ?? "—"}
            </span>
          )}
          {ownerView && slot.upcomingCount > 0 && (
            <span className="ml-auto text-[12px] font-semibold" style={{ color: "var(--carblue)" }}>
              {slot.upcomingCount} upcoming
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function BookerRow({ b, busy, onOpen, onPay, onCancel }: { b: BookerBooking; busy: boolean; onOpen: () => void; onPay: () => void; onCancel: () => void }) {
  const upcoming = new Date(b.startAt).getTime() > Date.now();
  return (
    <div
      className="rounded-[16px] p-[15px]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: b.status === "CANCELLED" ? 0.6 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left text-[16px] font-bold active:underline" style={{ color: "var(--text)" }}>{b.slotLabel}</button>
        <span className="text-[16px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>{b.mode === "MONTHLY" ? `₹${b.monthlyRate}/mo` : `₹${b.totalAmount}`}</span>
      </div>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-2)" }}>{bookingDates(b)}</p>
      {b.vehicleNumber && <p className="one-mono mt-0.5 text-[12px]" style={{ color: "var(--text-3)" }}>{b.vehicleNumber}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={b.status} />
        {b.status === "BOOKED" && (
          b.ownerConfirmedPaid ? <span className="text-[11px] font-bold" style={{ color: "var(--success)" }}>PAID ✓ confirmed</span>
          : b.bookerPaid ? <span className="text-[11px] font-bold" style={{ color: "var(--warning)" }}>PAID — awaiting confirm</span>
          : <button onClick={onPay} disabled={busy} className="rounded-full px-3.5 py-1.5 text-[13px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>I&apos;ve paid</button>
        )}
        {b.status === "BOOKED" && upcoming && <button onClick={onCancel} disabled={busy} className="ml-auto text-[11px] font-bold" style={{ color: "var(--danger)" }}>Cancel</button>}
      </div>
    </div>
  );
}

function OwnerRow({ b, busy, onOpen, onConfirm, onCancel }: { b: OwnerBooking; busy: boolean; onOpen: () => void; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="rounded-[16px] p-[15px]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: b.status === "CANCELLED" ? 0.6 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left text-[16px] font-bold active:underline" style={{ color: "var(--text)" }}>{b.slotLabel}</button>
        <span className="text-[16px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>{b.mode === "MONTHLY" ? `₹${b.monthlyRate}/mo` : `₹${b.totalAmount}`}</span>
      </div>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-2)" }}>{bookingDates(b)}</p>
      <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-3)" }}>{b.booker.name} · B{b.booker.block ?? "—"}, {b.booker.flatNumber}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={b.status} />
        {b.status === "BOOKED" && (
          b.ownerConfirmedPaid ? <span className="text-[11px] font-bold" style={{ color: "var(--success)" }}>Payment confirmed</span>
          : <button onClick={onConfirm} disabled={busy} className="rounded-full px-3.5 py-1.5 text-[13px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--success)" }}>{b.bookerPaid ? "Confirm payment" : "Mark received"}</button>
        )}
        {b.status === "BOOKED" && <button onClick={onCancel} disabled={busy} className="ml-auto text-[11px] font-bold" style={{ color: "var(--danger)" }}>Cancel</button>}
      </div>
    </div>
  );
}

function SlotBadge({ tone, children }: { tone: "success" | "warning" | "accent" | "muted"; children: React.ReactNode }) {
  if (tone === "muted") {
    return (
      <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>
        {children}
      </span>
    );
  }
  const fg = `var(--${tone})`;
  const bg = `var(--${tone}-soft)`;
  const border = tone === "success" ? "var(--success-line)" : `color-mix(in srgb, ${fg} 35%, transparent)`;
  return (
    <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: bg, color: fg, border: `1px solid ${border}` }}>
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "CANCELLED" ? "danger" : status === "COMPLETED" ? "muted" : "success";
  if (tone === "muted") {
    return <span className="rounded-full px-3 py-1 text-[12px] font-bold tracking-wide" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>{status}</span>;
  }
  return (
    <span
      className="rounded-full px-3 py-1 text-[12px] font-bold tracking-wide"
      style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})`, border: tone === "success" ? "1px solid var(--success-line)" : undefined }}
    >
      {status === "BOOKED" ? "BOOKED" : status}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div
      className="rounded-[18px] px-4 py-10 text-center text-[14px]"
      style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-3)" }}
    >
      <Icon name="schedule" size={26} className="mx-auto mb-2 block" style={{ color: "var(--text-3)" }} />
      {text}
    </div>
  );
}

function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso), e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  const d = s.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const st = s.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const et = e.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `${d}, ${st} – ${et}` : `${d} ${st} → ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${et}`;
}
// Date label for a booking row — hourly shows the time range, monthly the dates.
function bookingDates(b: { mode?: string; openEnded?: boolean; startAt: string; endAt: string }): string {
  if (b.mode === "MONTHLY") {
    const from = new Date(b.startAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (b.openEnded) return `Monthly · from ${from} · ongoing`;
    const to = new Date(new Date(b.endAt).getTime() - 86_400_000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return `Monthly · ${from} → ${to}`;
  }
  return fmtRange(b.startAt, b.endAt);
}
