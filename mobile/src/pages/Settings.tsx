import { useState } from "react";
import { Loader2, LogOut, Monitor, Moon, Siren, Sun } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useTheme, type ThemePref } from "../theme/ThemeProvider";

const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function Settings() {
  const { token, user, updateUser, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
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
      <header className="py-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Appearance, accessibility & account
        </p>
      </header>

      {/* Appearance */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Appearance
        </h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={
                    "flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition-colors " +
                    (active
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400")
                  }
                >
                  <Icon size={18} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-500">
          “System” follows your phone’s light/dark setting. Saved on this device.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Accessibility
        </h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500 dark:text-red-300">
              <Siren size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Senior-friendly mode</p>
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
                (senior ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform " +
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

      {/* Account */}
      {user && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Account
          </h2>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-semibold text-red-600 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-red-300 dark:active:bg-slate-800"
          >
            <LogOut size={16} />
            Sign out
          </button>
          <p className="mt-2 px-1 text-[11px] text-slate-500">
            Signed in as {user.name}
            {user.block ? ` · Block ${user.block}` : ""}
          </p>
        </section>
      )}
    </div>
  );
}
