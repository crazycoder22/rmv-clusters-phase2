import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Slot = {
  id: string;
  label: string | null;
  dayOfWeek: number | null;
  startMinute: number;
  endMinute: number;
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export default function AdminAmenityEdit() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [fee, setFee] = useState("0");
  const [feeNote, setFeeNote] = useState("");
  const [payInfo, setPayInfo] = useState("");
  const [maxPerResident, setMaxPerResident] = useState("");
  const [bookingWindowDays, setBookingWindowDays] = useState("30");
  const [active, setActive] = useState(true);

  // slots (edit mode only)
  const [slots, setSlots] = useState<Slot[]>([]);
  const [newDow, setNewDow] = useState<string>("all");
  const [newStart, setNewStart] = useState("06:00");
  const [newEnd, setNewEnd] = useState("07:00");
  const [newLabel, setNewLabel] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);

  const load = useCallback(async () => {
    if (!token || isNew || !id) return;
    try {
      const res = await apiFetch(`/api/amenities/${id}`, { token });
      if (res.ok) {
        const { amenity } = await res.json();
        setName(amenity.name);
        setDescription(amenity.description ?? "");
        setLocation(amenity.location ?? "");
        setCapacity(String(amenity.capacity));
        setRequiresApproval(amenity.requiresApproval);
        setFee(String(amenity.fee));
        setFeeNote(amenity.feeNote ?? "");
        setPayInfo(amenity.payInfo ?? "");
        setMaxPerResident(amenity.maxPerResident != null ? String(amenity.maxPerResident) : "");
        setBookingWindowDays(String(amenity.bookingWindowDays));
        setActive(amenity.active);
        setSlots(amenity.slots ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!token || saving) return;
    if (!name.trim()) {
      window.alert("Name is required");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      location: location.trim(),
      capacity: parseInt(capacity, 10) || 1,
      requiresApproval,
      fee: parseFloat(fee) || 0,
      feeNote: feeNote.trim(),
      payInfo: payInfo.trim(),
      maxPerResident: maxPerResident.trim() ? parseInt(maxPerResident, 10) : null,
      bookingWindowDays: parseInt(bookingWindowDays, 10) || 30,
      active,
    };
    try {
      if (isNew) {
        const res = await apiFetch("/api/amenities", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.id) {
          navigate(`/admin/amenities/${data.id}`, { replace: true });
        } else {
          window.alert(data?.error ?? "Could not create");
        }
      } else {
        const res = await apiFetch(`/api/amenities/${id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
        if (res.ok) navigate(`/amenities/${id}`);
        else window.alert((await res.json().catch(() => null))?.error ?? "Could not save");
      }
    } catch {
      window.alert("Save failed. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function addSlot() {
    if (!token || !id || addingSlot) return;
    const start = hhmmToMin(newStart);
    const end = hhmmToMin(newEnd);
    if (end <= start) {
      window.alert("End time must be after start time");
      return;
    }
    setAddingSlot(true);
    try {
      const res = await apiFetch(`/api/amenities/${id}/slots`, {
        method: "POST",
        token,
        body: JSON.stringify({
          dayOfWeek: newDow === "all" ? null : parseInt(newDow, 10),
          startMinute: start,
          endMinute: end,
          label: newLabel.trim(),
        }),
      });
      if (res.ok) {
        setNewLabel("");
        await load();
      } else {
        window.alert((await res.json().catch(() => null))?.error ?? "Could not add slot");
      }
    } catch {
      // ignore
    } finally {
      setAddingSlot(false);
    }
  }

  async function delSlot(slotId: string) {
    if (!token || !id) return;
    try {
      const res = await apiFetch(`/api/amenities/${id}/slots/${slotId}`, { method: "DELETE", token });
      if (res.ok) setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch {
      // ignore
    }
  }

  async function deleteAmenity() {
    if (!token || !id) return;
    if (!window.confirm("Delete this amenity? All its slots and bookings will be removed. This cannot be undone.")) return;
    try {
      const res = await apiFetch(`/api/amenities/${id}`, { method: "DELETE", token });
      if (res.ok) navigate("/amenities");
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-slate-500" size={22} />
      </div>
    );
  }

  const field = "w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none";
  const lbl = "mb-1 block text-xs font-medium text-slate-400";

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-10">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 active:text-white">
        <ArrowLeft size={18} /> Back
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {isNew ? "New amenity" : "Edit amenity"}
      </h1>

      <div className="mt-5 space-y-4">
        <div>
          <label className={lbl}>Name *</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Clubhouse, Tennis Court A…" />
        </div>
        <div>
          <label className={lbl}>Description</label>
          <textarea className={field} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Location</label>
          <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Near Block 2 lobby" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={lbl}>Capacity (per slot)</label>
            <input className={field} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className={lbl}>Book ahead (days)</label>
            <input className={field} inputMode="numeric" value={bookingWindowDays} onChange={(e) => setBookingWindowDays(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={lbl}>Fee (₹)</label>
            <input className={field} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className={lbl}>Max per resident</label>
            <input className={field} inputMode="numeric" value={maxPerResident} onChange={(e) => setMaxPerResident(e.target.value)} placeholder="∞" />
          </div>
        </div>
        {parseFloat(fee) > 0 ? (
          <>
            <div>
              <label className={lbl}>Fee note</label>
              <input className={field} value={feeNote} onChange={(e) => setFeeNote(e.target.value)} placeholder="₹500 refundable deposit" />
            </div>
            <div>
              <label className={lbl}>Payment info (UPI / phone)</label>
              <input className={field} value={payInfo} onChange={(e) => setPayInfo(e.target.value)} placeholder="society@upi" />
            </div>
          </>
        ) : null}
        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5">
          <span className="text-sm text-slate-200">Require approval</span>
          <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} className="h-5 w-5 accent-indigo-500" />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5">
          <span className="text-sm text-slate-200">Visible to residents</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-indigo-500" />
        </label>

        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {isNew ? "Create amenity" : "Save changes"}
        </button>
      </div>

      {/* Slot templates — edit mode only */}
      {!isNew ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-white">Bookable slots</h2>
          <p className="mt-0.5 text-xs text-slate-400">Recurring time windows residents can book.</p>

          <div className="mt-3 space-y-2">
            {slots.length === 0 ? (
              <p className="rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-3 text-center text-xs text-slate-500">
                No slots yet — add one below.
              </p>
            ) : (
              slots.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5">
                  <div className="flex-1">
                    <p className="text-sm text-white">
                      {minToHHMM(s.startMinute)} – {minToHHMM(s.endMinute)}
                      {s.label ? <span className="ml-2 text-xs text-slate-400">{s.label}</span> : null}
                    </p>
                    <p className="text-[11px] text-slate-500">{s.dayOfWeek == null ? "Every day" : DOW[s.dayOfWeek]}</p>
                  </div>
                  <button onClick={() => void delSlot(s.id)} className="text-slate-500 active:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add slot */}
          <div className="mt-3 rounded-xl border border-dashed border-slate-600 px-3 py-3">
            <div className="flex gap-2">
              <select className={field} value={newDow} onChange={(e) => setNewDow(e.target.value)}>
                <option value="all">Every day</option>
                {DOW.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <div className="flex-1">
                <label className={lbl}>Start</label>
                <input type="time" className={field} value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className={lbl}>End</label>
                <input type="time" className={field} value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
            </div>
            <input className={`${field} mt-2`} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (optional)" />
            <button
              onClick={() => void addSlot()}
              disabled={addingSlot}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-3 py-2.5 text-sm font-medium text-white active:bg-slate-600 disabled:opacity-60"
            >
              {addingSlot ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add slot
            </button>
          </div>

          <button
            onClick={() => void deleteAmenity()}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-300 active:bg-red-500/15"
          >
            <Trash2 size={16} /> Delete amenity
          </button>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-slate-500">
          Save the amenity first, then add bookable slots.
        </p>
      )}
    </div>
  );
}
