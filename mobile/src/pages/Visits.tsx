import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Car,
  ChevronLeft,
  ChevronRight,
  Package,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
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
  const ist = new Date(
    now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000
  );
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

function categorize(v: Visit): { icon: LucideIcon; tint: string; label: string } {
  const t = v.visitorType?.toLowerCase() ?? "";
  if (t.includes("deliver") || v.fromSource)
    return {
      icon: Package,
      tint: "bg-orange-500/20 text-orange-300",
      label: v.fromSource ?? "Delivery",
    };
  if (t.includes("cab") || t.includes("taxi") || t.includes("driver"))
    return {
      icon: Car,
      tint: "bg-amber-500/20 text-amber-300",
      label: "Cab",
    };
  if (t.includes("guest") || t.includes("visitor"))
    return {
      icon: User,
      tint: "bg-indigo-500/20 text-indigo-300",
      label: "Guest",
    };
  if (
    t.includes("help") ||
    t.includes("maid") ||
    t.includes("cook") ||
    t.includes("domestic") ||
    t.includes("nanny")
  )
    return {
      icon: Sparkles,
      tint: "bg-emerald-500/20 text-emerald-300",
      label: "Domestic help",
    };
  if (
    t.includes("plumb") ||
    t.includes("electric") ||
    t.includes("repair") ||
    t.includes("technic") ||
    t.includes("service")
  )
    return {
      icon: Wrench,
      tint: "bg-sky-500/20 text-sky-300",
      label: "Service",
    };
  return {
    icon: Users,
    tint: "bg-slate-700 text-slate-300",
    label: v.visitorType || "Visitor",
  };
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
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Your Visitors</h1>
      </header>

      <p className="mb-4 text-xs text-slate-500">
        Visitors to your flat, imported from MyGate.
      </p>

      {/* Date picker */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 px-2 py-2">
        <button
          onClick={() => setDate((d) => shiftDay(d, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-700"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Calendar size={14} className="text-slate-500" />
          {formatHumanDate(date)}
        </div>
        <button
          onClick={() => setDate((d) => shiftDay(d, 1))}
          disabled={isToday}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-700 disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : visits.length === 0 ? (
        <div className="py-16 text-center">
          <Users size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No visitors logged.</p>
          <p className="mt-1 text-xs text-slate-500">
            Visit log is imported from MyGate periodically.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat label="Total" value={total} />
            <Stat
              label="Approved by you"
              value={residentApproved}
              tint="bg-green-500/20 text-green-300"
            />
          </div>
          <div className="space-y-2 pb-4">
            {visits.map((v) => (
              <VisitCard key={v.id} v={v} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
      <p className={clsx("text-xl font-bold", tint ?? "text-white")}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function VisitCard({ v }: { v: Visit }) {
  const cat = categorize(v);
  const Icon = cat.icon;
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
            cat.tint
          )}
        >
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {v.visitorName}
            </p>
            {v.approvedByResident && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-bold text-green-300">
                <ShieldCheck size={9} />
                You
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {cat.label}
            {v.fromSource && cat.label !== v.fromSource
              ? ` · ${v.fromSource}`
              : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            <span>
              In <span className="font-mono text-slate-300">{fmtTime(v.inTime)}</span>
            </span>
            {v.outTime && (
              <span>
                · Out{" "}
                <span className="font-mono text-slate-300">
                  {fmtTime(v.outTime)}
                </span>
              </span>
            )}
            {v.gate && <span>· Gate {v.gate}</span>}
          </div>
          {(v.allowedByGuard || v.approvedBy) && (
            <p className="mt-1 text-[10px] text-slate-500">
              {v.approvedByResident
                ? `Approved by ${v.approvedBy ?? "a resident"}`
                : v.allowedByGuard
                  ? `Walked through by ${v.allowedByGuard}`
                  : ""}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
