import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Visit = {
  id: string;
  visitDate: string;
  visitorName: string;
  visitorType: string;
  fromSource: string | null;
  block: number | null;
  flatNumber: string | null;
  inTime: string | null;
  outTime: string | null;
  approvedBy: string | null;
  allowedByGuard: string | null;
  approvedByResident: boolean;
  gate: string | null;
  status: string | null;
};

function todayIst(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function shiftDay(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().split("T")[0];
}

function formatHumanDate(ymd: string): string {
  const today = todayIst();
  if (ymd === today) return "Today";
  if (ymd === shiftDay(today, -1)) return "Yesterday";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Map a MyGate visit to an OneRMV category (icon + token colours + tag).
// Follows OneRMV Visitors.dc.html.
type Cat = { ms: string; color: string; soft: string; tag: string };
function categorize(v: Visit): Cat {
  const t = v.visitorType?.toLowerCase() ?? "";
  if (t.includes("deliver") || v.fromSource)
    return { ms: "deployed_code", color: "var(--deliver)", soft: "var(--deliver-soft)", tag: "Delivery" };
  if (t.includes("cab") || t.includes("taxi") || t.includes("driver"))
    return { ms: "local_taxi", color: "var(--info)", soft: "var(--info-soft)", tag: "Cab" };
  if (t.includes("help") || t.includes("maid") || t.includes("cook") || t.includes("domestic") || t.includes("nanny"))
    return { ms: "cleaning_services", color: "var(--produce)", soft: "var(--success-soft)", tag: "Daily help" };
  if (t.includes("plumb") || t.includes("electric") || t.includes("repair") || t.includes("technic") || t.includes("service"))
    return { ms: "build", color: "var(--info)", soft: "var(--info-soft)", tag: "Service" };
  if (t.includes("guest") || t.includes("visitor"))
    return { ms: "person", color: "var(--accent)", soft: "var(--accent-soft)", tag: "Guest" };
  return { ms: "person", color: "var(--text-2)", soft: "var(--surface-3)", tag: v.visitorType || "Visitor" };
}

export default function VisitsPage() {
  const { token } = useAuth();
  const [date, setDate] = useState<string>(todayIst());
  const [visits, setVisits] = useState<Visit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/visit-log?date=${date}&limit=200`, { token })
      .then((r) => (r.ok ? r.json() : { items: [], total: 0 }))
      .then((data) => {
        if (cancelled) return;
        setVisits(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, token]);

  const isToday = date === todayIst();
  const residentApproved = visits.filter((v) => v.approvedByResident).length;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 py-2.5">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Your Visitors</h1>
      </header>
      <p className="mb-3.5 text-[13.5px]" style={{ color: "var(--text-3)" }}>
        Visitors to your flat, imported from MyGate.
      </p>

      {/* Date selector */}
      <div className="flex items-center justify-between rounded-[16px] p-[5px]" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
        <button
          onClick={() => setDate((d) => shiftDay(d, -1))}
          className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] active:opacity-70"
          style={{ color: "var(--text-2)" }}
          aria-label="Previous day"
        >
          <Icon name="chevron_left" size={22} style={{ color: "var(--text-2)" }} />
        </button>
        <div className="flex items-center gap-2" style={{ color: "var(--text)" }}>
          <Icon name="calendar_today" size={19} style={{ color: "var(--text-3)" }} />
          <span className="text-[16px] font-bold">{formatHumanDate(date)}</span>
        </div>
        <button
          onClick={() => setDate((d) => shiftDay(d, 1))}
          disabled={isToday}
          className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] active:opacity-70 disabled:opacity-40"
          style={{ color: "var(--text-2)" }}
          aria-label="Next day"
        >
          <Icon name="chevron_right" size={22} style={{ color: "var(--text-2)" }} />
        </button>
      </div>

      {/* Stats */}
      <div className="mt-3.5 flex gap-3">
        <div className="flex flex-1 flex-col items-center gap-1.5 rounded-[16px] px-3 py-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span className="text-[30px] font-extrabold leading-none" style={{ color: "var(--text)" }}>{total}</span>
          <span className="one-mono text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>TOTAL</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1.5 rounded-[16px] px-3 py-[18px]" style={{ background: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 32%, var(--border))" }}>
          <span className="text-[30px] font-extrabold leading-none" style={{ color: "var(--success)" }}>{residentApproved}</span>
          <span className="one-mono text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>APPROVED BY YOU</span>
        </div>
      </div>

      {/* Visitor list */}
      <div className="mt-3.5 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
        ) : visits.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[18px] px-6 py-10 text-center" style={{ border: "1.5px dashed var(--border-strong)" }}>
            <Icon name="person_off" size={40} style={{ color: "var(--text-3)" }} />
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-3)" }}>No visitors logged for your flat on this day.</p>
          </div>
        ) : (
          visits.map((v) => <VisitCard key={v.id} v={v} />)
        )}
      </div>
    </div>
  );
}

function VisitCard({ v }: { v: Visit }) {
  const cat = categorize(v);
  const source = (v.fromSource ?? cat.tag).toUpperCase();
  return (
    <div className="flex gap-3 rounded-[18px] p-[15px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full" style={{ background: cat.soft }}>
        <Icon name={cat.ms} size={23} fill style={{ color: cat.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[16.5px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{v.visitorName}</span>
          <span className="flex-shrink-0 rounded-full px-2.5 py-[3px] text-[10px] font-bold" style={{ background: cat.soft, color: cat.color }}>{cat.tag}</span>
        </div>
        <div className="one-mono mt-1 text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.06em" }}>{source}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]" style={{ color: "var(--text-2)" }}>
          <span style={{ color: "var(--text-3)" }}>In</span>
          <span className="one-mono font-semibold" style={{ color: "var(--text)" }}>{fmtTime(v.inTime)}</span>
          {v.outTime && (
            <>
              <span style={{ color: "var(--text-3)" }}>·</span>
              <span style={{ color: "var(--text-3)" }}>Out</span>
              <span className="one-mono font-semibold" style={{ color: "var(--text)" }}>{fmtTime(v.outTime)}</span>
            </>
          )}
          {v.gate && <span style={{ color: "var(--text-3)" }}>· Gate {v.gate}</span>}
        </div>
        {v.approvedByResident ? (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--success)" }}>
            <Icon name="verified_user" size={14} fill style={{ color: "var(--success)" }} />
            Approved by {v.approvedBy ? `${v.approvedBy}` : "you"}
          </div>
        ) : v.allowedByGuard ? (
          <div className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-3)" }}>
            <Icon name="directions_walk" size={14} style={{ color: "var(--text-3)" }} />
            Walked through by {v.allowedByGuard}
          </div>
        ) : null}
      </div>
    </div>
  );
}
