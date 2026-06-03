import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Loader2,
  Plus,
  Building2,
  Users,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAmenities } from "../lib/roles";

type Amenity = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number;
  requiresApproval: boolean;
  fee: number;
  feeNote: string | null;
  active: boolean;
  slotCount: number;
};

export default function Amenities() {
  const { token, user } = useAuth();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = canManageAmenities(user?.roles);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch("/api/amenities", { token })
      .then((r) => (r.ok ? r.json() : { amenities: [] }))
      .then((data) => {
        if (!cancelled) setAmenities(data.amenities ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Amenities
        </h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Book the clubhouse, courts, gym and more
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        <Link
          to="/amenities/my-bookings"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm font-medium text-slate-200 active:bg-slate-700"
        >
          <CalendarCheck size={16} /> My bookings
        </Link>
        {canManage ? (
          <Link
            to="/admin/amenities/approvals"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm font-medium text-slate-200 active:bg-slate-700"
          >
            <ClipboardList size={16} /> Approvals
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-slate-500" size={22} />
        </div>
      ) : amenities.length === 0 ? (
        <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">
          No amenities are set up yet.
        </p>
      ) : (
        <div className="space-y-3">
          {amenities.map((a) => (
            <Link
              key={a.id}
              to={`/amenities/${a.id}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3.5 active:bg-slate-700"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                <Building2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  {a.name}
                  {!a.active ? (
                    <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                      Hidden
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                  {a.location ? <span>{a.location}</span> : null}
                  <span className="inline-flex items-center gap-0.5">
                    <Users size={11} /> {a.capacity === 1 ? "Exclusive" : `${a.capacity} spots`}
                  </span>
                  {a.fee > 0 ? <span className="text-amber-300">₹{a.fee}</span> : <span className="text-emerald-300">Free</span>}
                  {a.requiresApproval ? <span className="text-sky-300">Approval</span> : null}
                </p>
              </div>
              <ChevronRight size={18} className="text-slate-500" />
            </Link>
          ))}
        </div>
      )}

      {canManage ? (
        <Link
          to="/admin/amenities/new"
          className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 active:bg-slate-800"
        >
          <Plus size={16} /> Add an amenity
        </Link>
      ) : null}
    </div>
  );
}
