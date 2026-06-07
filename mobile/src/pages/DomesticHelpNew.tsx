import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { DOMESTIC_HELP_CATEGORIES } from "../lib/domesticHelp";

export default function DomesticHelpNew() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [availability, setAvailability] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleCat(v: string) {
    setCategories((prev) => (prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v]));
  }

  async function submit() {
    setErr(null);
    if (!name.trim()) return setErr("Name is required");
    if (!phone.trim()) return setErr("Phone is required");
    if (categories.length === 0) return setErr("Pick at least one category");
    setSaving(true);
    try {
      const res = await apiFetch("/api/domestic-help", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          categories,
          availability: availability.trim() || null,
          description: description.trim() || null,
        }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.worker?.id) navigate(`/domestic-help/${d.worker.id}`);
      else setErr(d?.error ?? "Could not add");
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none";
  const lbl = "mb-1 block text-xs font-medium text-slate-400";

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-10">
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold text-white">Add domestic help</h1>
      </header>

      <div className="space-y-3">
        <div>
          <label className={lbl}>Name</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lakshmi" />
        </div>
        <div>
          <label className={lbl}>Phone</label>
          <input className={field} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />
        </div>
        <div>
          <label className={lbl}>Services</label>
          <div className="flex flex-wrap gap-2">
            {DOMESTIC_HELP_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => toggleCat(c.value)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-medium " +
                  (categories.includes(c.value) ? "bg-indigo-600 text-white" : "border border-slate-700 bg-slate-800/60 text-slate-300")
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={lbl}>Availability (optional)</label>
          <input className={field} value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="e.g. Mon–Sat, 8am–6pm" />
        </div>
        <div>
          <label className={lbl}>Notes (optional)</label>
          <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything helpful for neighbours" />
        </div>

        {err && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs text-red-200">{err}</p>}

        <button onClick={() => void submit()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          Add to directory
        </button>
      </div>
    </div>
  );
}
