import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Shield,
  Siren,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Responder = {
  name: string;
  block: number;
  flatNumber: string;
  respondedAt: string;
};

type AlertDetail = {
  id: string;
  senderName: string;
  senderBlock: number;
  senderFlat: string;
  senderPhone: string;
  note: string | null;
  status: "ACTIVE" | "RESOLVED";
  createdAt: string;
  resolvedAt: string | null;
  amSender: boolean;
  amWarrior: boolean;
  myResponded: boolean;
  responders: Responder[];
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.max(0, Math.floor((now - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SosAlert() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await apiFetch(`/api/sos/alerts/${id}`, { token });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as AlertDetail;
        setAlert(data);
      }
    } catch {
      // keep last state on transient errors
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 3s while the alert is ACTIVE so responders/status update live.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (alert && alert.status === "ACTIVE") {
      pollRef.current = setInterval(() => void load(), 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [alert?.status, load]);

  async function toggleResponse() {
    if (!token || !id || !alert) return;
    setBusy(true);
    const method = alert.myResponded ? "DELETE" : "POST";
    try {
      const res = await apiFetch(`/api/sos/alerts/${id}/respond`, {
        method,
        token,
      });
      if (res.ok) await load();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    if (!token || !id) return;
    if (
      !window.confirm(
        "Mark this SOS as resolved? Responders will be notified and it will close."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/sos/alerts/${id}/resolve`, {
        method: "POST",
        token,
      });
      if (res.ok) await load();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-slate-500" size={22} />
      </div>
    );
  }

  if (notFound || !alert) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-sm text-slate-400 active:text-white"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center">
          <p className="text-sm text-slate-400">
            This SOS alert isn't available.
          </p>
        </div>
      </div>
    );
  }

  const isActive = alert.status === "ACTIVE";
  const cleanPhone = alert.senderPhone.replace(/\s+/g, "");

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-1.5 text-sm text-slate-400 active:text-white"
      >
        <ArrowLeft size={18} /> Back
      </button>

      {/* Status header */}
      <div
        className={
          isActive
            ? "rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-5"
            : "rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-5"
        }
      >
        <div className="flex items-center gap-2">
          {isActive ? (
            <Siren size={20} className="text-red-400" />
          ) : (
            <CheckCircle2 size={20} className="text-emerald-400" />
          )}
          <p
            className={
              isActive
                ? "text-sm font-bold uppercase tracking-wide text-red-300"
                : "text-sm font-bold uppercase tracking-wide text-emerald-300"
            }
          >
            {isActive ? "Active emergency" : "Resolved"}
          </p>
        </div>
        <p className="mt-3 text-lg font-semibold text-white">
          {alert.senderName}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-300">
          <MapPin size={14} className="text-slate-400" />
          Block {alert.senderBlock}, Flat {alert.senderFlat}
        </div>
        {alert.note ? (
          <p className="mt-2 text-sm text-slate-300">“{alert.note}”</p>
        ) : null}
        <p className="mt-2 text-[11px] text-slate-500">
          Raised {timeAgo(alert.createdAt)}
          {alert.resolvedAt ? ` · resolved ${timeAgo(alert.resolvedAt)}` : ""}
        </p>
      </div>

      {/* Call button — available to anyone authorized to view (sender/warrior) */}
      {isActive ? (
        <a
          href={`tel:${cleanPhone}`}
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white active:bg-emerald-700"
        >
          <Phone size={18} /> Call {alert.senderName.split(" ")[0]}
        </a>
      ) : null}

      {/* Warrior action: I'm on my way / withdraw */}
      {alert.amWarrior && !alert.amSender && isActive ? (
        <button
          onClick={() => void toggleResponse()}
          disabled={busy}
          className={
            alert.myResponded
              ? "mt-3 flex items-center justify-center gap-2 rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3.5 text-base font-semibold text-slate-200 active:bg-slate-700 disabled:opacity-60"
              : "mt-3 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white active:bg-indigo-700 disabled:opacity-60"
          }
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Shield size={18} />
          )}
          {alert.myResponded ? "I can't make it — withdraw" : "I'm on my way"}
        </button>
      ) : null}

      {/* Responders list */}
      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {alert.responders.length === 0
            ? "No responders yet"
            : `${alert.responders.length} on the way`}
        </p>
        {alert.responders.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
            {alert.responders.map((r, i) => (
              <div
                key={`${r.name}-${i}`}
                className={
                  i < alert.responders.length - 1
                    ? "flex items-center gap-3 border-b border-slate-700 px-4 py-3"
                    : "flex items-center gap-3 px-4 py-3"
                }
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
                  <Shield size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-100">{r.name}</p>
                  <p className="text-[11px] text-slate-500">
                    Block {r.block}, Flat {r.flatNumber}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500">
                  {timeAgo(r.respondedAt)}
                </p>
              </div>
            ))}
          </div>
        ) : isActive ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-5 text-center text-xs text-slate-500">
            Waiting for SOS warriors to respond…
          </p>
        ) : null}
      </div>

      {/* Resolve — sender or any warrior */}
      {isActive && (alert.amSender || alert.amWarrior) ? (
        <button
          onClick={() => void resolve()}
          disabled={busy}
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-emerald-600/50 bg-emerald-600/10 px-4 py-3 text-sm font-semibold text-emerald-300 active:bg-emerald-600/20 disabled:opacity-60"
        >
          <CheckCircle2 size={16} /> Mark as resolved
        </button>
      ) : null}
    </div>
  );
}
