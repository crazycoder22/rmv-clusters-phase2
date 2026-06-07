import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Siren } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

export default function Settings() {
  const { token, user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const senior = !!user?.isSeniorCitizen;

  async function toggleSenior(next: boolean) {
    if (!token || saving) return;
    setSaving(true);
    // Optimistic update; revert on failure.
    await updateUser({ isSeniorCitizen: next });
    try {
      const res = await apiFetch("/api/me", {
        method: "PATCH",
        token,
        body: JSON.stringify({ isSeniorCitizen: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      await updateUser({ isSeniorCitizen: !next });
      window.alert("Couldn't save the setting. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </header>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Accessibility
        </h2>
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <Siren size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Senior-friendly mode</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Show the Emergency SOS button at the top of your home screen for easy access.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={senior}
              disabled={saving}
              onClick={() => void toggleSenior(!senior)}
              className={
                "relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 " +
                (senior ? "bg-indigo-600" : "bg-slate-600")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform " +
                  (senior ? "translate-x-[22px]" : "translate-x-0.5")
                }
              />
              {saving ? (
                <Loader2
                  size={12}
                  className="absolute right-1.5 top-2 animate-spin text-white/80"
                />
              ) : null}
            </button>
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-500">
          This preference is saved to your account and applies on all your devices.
        </p>
      </section>
    </div>
  );
}
