import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CircleDot, Loader2, Send, Wrench, Zap } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Category = "ELECTRICAL" | "PLUMBING" | "OTHER";

const CATS: { value: Category; label: string; icon: typeof Wrench }[] = [
  { value: "ELECTRICAL", label: "Electrical", icon: Zap },
  { value: "PLUMBING", label: "Plumbing", icon: Wrench },
  { value: "OTHER", label: "Other", icon: CircleDot },
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
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
        }),
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

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/issues"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Raise an issue</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        <section>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Category
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CATS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-xl border px-3 py-3 transition-colors",
                  category === value
                    ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                    : "border-slate-700 bg-slate-800/60 text-slate-400"
                )}
              >
                <Icon size={18} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <label
            htmlFor="title"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Corridor light not working"
            maxLength={120}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
        </section>

        <section>
          <label
            htmlFor="description"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Where exactly is the issue? When did it start? Anything that helps the team fix it."
            rows={5}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
        </section>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send size={16} />
              Raise issue
            </>
          )}
        </button>

        <p className="pt-1 text-center text-[11px] text-slate-500">
          Facility managers will be notified immediately.
        </p>
      </form>
    </div>
  );
}
