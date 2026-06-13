import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Category = "ELECTRICAL" | "PLUMBING" | "OTHER";

const CATS: { value: Category; label: string; ms: string }[] = [
  { value: "ELECTRICAL", label: "Electrical", ms: "bolt" },
  { value: "PLUMBING", label: "Plumbing", ms: "plumbing" },
  { value: "OTHER", label: "Other", ms: "adjust" },
];

export default function IssueNew() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!category) {
      setError("Pick a category.");
      return;
    }
    if (title.trim().length < 3) {
      setError("Title is too short.");
      return;
    }
    if (description.trim().length < 5) {
      setError("Add a bit more detail in the description.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/issues", {
        method: "POST",
        token,
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not raise. Please try again.");
        return;
      }
      navigate("/issues");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const mono = "one-mono mb-2.5 text-[11px]";
  const monoStyle = { color: "var(--text-3)", letterSpacing: "0.1em" } as const;

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-10" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3 py-3">
        <button onClick={() => navigate("/issues")} className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </button>
        <h1 className="text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Raise an issue</h1>
      </header>

      <form onSubmit={handleSubmit} className="pt-1.5">
        {/* Category */}
        <p className={mono} style={monoStyle}>CATEGORY</p>
        <div className="flex gap-2.5">
          {CATS.map(({ value, label, ms }) => {
            const on = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className="flex flex-1 flex-col items-center gap-2 rounded-[14px] px-1.5 py-4 text-[13.5px] font-semibold"
                style={on
                  ? { background: "var(--accent-soft)", border: "1.5px solid var(--accent)", color: "var(--accent)" }
                  : { background: "var(--surface-2)", border: "1.5px solid var(--border-strong)", color: "var(--text-2)" }}
              >
                <Icon name={ms} size={22} style={{ color: on ? "var(--accent)" : "var(--text-2)" }} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Title */}
        <p className={`${mono} mt-[22px]`} style={monoStyle}>TITLE</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Corridor light not working"
          maxLength={120}
          className="one-input w-full rounded-[12px] px-4 py-3.5 text-[14.5px]"
        />

        {/* Description */}
        <p className={`${mono} mt-[22px]`} style={monoStyle}>DESCRIPTION</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Where exactly is the issue? When did it start? Anything that helps the team fix it."
          rows={5}
          className="one-input w-full resize-none rounded-[12px] px-4 py-3.5 text-[14.5px] leading-relaxed"
        />

        {error && <p className="mt-4 rounded-[12px] px-3.5 py-2.5 text-center text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-[14px] py-4 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent-strong)", boxShadow: "0 8px 22px var(--accent-soft)" }}
        >
          {submitting ? <Loader2 size={17} className="animate-spin" /> : <Icon name="near_me" size={20} fill style={{ color: "#fff" }} />}
          {submitting ? "Sending…" : "Raise issue"}
        </button>

        <p className="mt-3.5 text-center text-[12.5px]" style={{ color: "var(--text-3)" }}>Facility managers will be notified immediately.</p>
      </form>
    </div>
  );
}
