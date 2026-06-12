import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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

  const canSubmit = name.trim() && phone.trim() && categories.length > 0;
  const field = "one-input w-full rounded-[13px] px-4 py-3.5 text-[15px]";
  const lbl = "mb-2 block text-[14px] font-semibold";

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-10" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3.5 py-3">
        <button onClick={() => navigate(-1)} className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text)" }} />
        </button>
        <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Add domestic help</h1>
      </header>

      <div className="pt-1.5">
        <label className={lbl} style={{ color: "var(--text-2)" }}>Name</label>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lakshmi" />

        <label className={`${lbl} mt-[18px]`} style={{ color: "var(--text-2)" }}>Phone</label>
        <input className={field} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />

        <label className={`${lbl} mt-[18px]`} style={{ color: "var(--text-2)" }}>Services</label>
        <div className="flex flex-wrap gap-2.5">
          {DOMESTIC_HELP_CATEGORIES.map((c) => {
            const on = categories.includes(c.value);
            return (
              <button
                key={c.value}
                onClick={() => toggleCat(c.value)}
                className="rounded-full px-4 py-2 text-[14px] font-semibold"
                style={on
                  ? { background: "var(--accent-soft)", border: "1px solid var(--accent)", color: "var(--accent)" }
                  : { background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <label className={`${lbl} mt-5`} style={{ color: "var(--text-2)" }}>
          Availability <span className="font-medium" style={{ color: "var(--text-3)" }}>(optional)</span>
        </label>
        <input className={field} value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="e.g. Mon–Sat, 8am–6pm" />

        <label className={`${lbl} mt-[18px]`} style={{ color: "var(--text-2)" }}>
          Notes <span className="font-medium" style={{ color: "var(--text-3)" }}>(optional)</span>
        </label>
        <textarea className={`${field} resize-none leading-relaxed`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything helpful for neighbours" />

        {err && <p className="mt-3 rounded-[12px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{err}</p>}

        <button
          onClick={() => void submit()}
          disabled={saving || !canSubmit}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-4 text-[17px] font-bold"
          style={canSubmit
            ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 8px 20px var(--accent-soft)" }
            : { background: "var(--surface-3)", color: "var(--text-3)" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          Add to directory
        </button>
      </div>
    </div>
  );
}
