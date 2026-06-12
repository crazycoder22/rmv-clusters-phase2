import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useTheme, type ThemePref } from "../theme/ThemeProvider";

const THEME_OPTIONS: { value: ThemePref; ms: string; label: string }[] = [
  { value: "light", ms: "light_mode", label: "Light" },
  { value: "dark", ms: "dark_mode", label: "Dark" },
  { value: "system", ms: "brightness_auto", label: "System" },
];

export default function Settings() {
  const { token, user, updateUser, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
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

  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
          Settings
        </h1>
        <p className="mt-px text-[13px]" style={{ color: "var(--text-3)" }}>
          Manage your account &amp; preferences
        </p>
      </header>

      {/* Profile card */}
      <div
        className="flex items-center gap-3.5 rounded-[18px] p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="h-[52px] w-[52px] flex-shrink-0 rounded-full object-cover"
            style={{ border: "2px solid var(--accent)" }}
          />
        ) : (
          <div
            className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full text-[20px] font-extrabold"
            style={{ background: "var(--accent-soft)", border: "2px solid var(--accent)", color: "var(--accent)" }}
          >
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
            {user?.name ?? "Resident"}
          </div>
          {(user?.block || user?.flatNumber) && (
            <div className="one-mono mt-px text-[12px]" style={{ color: "var(--text-3)" }}>
              {user?.block ? `Block ${user.block}` : ""}
              {user?.block && user?.flatNumber ? " · " : ""}
              {user?.flatNumber ?? ""}
            </div>
          )}
        </div>
      </div>

      {/* Appearance */}
      <Eyebrow>Appearance</Eyebrow>
      <SectionCard>
        <Row ms="palette" title="Theme">
          <div
            className="flex gap-0.5 rounded-[10px] p-0.5"
            style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
          >
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  aria-label={opt.label}
                  className="flex items-center justify-center rounded-[7px] px-2.5 py-1.5"
                  style={active
                    ? { background: "var(--surface)", color: "var(--accent)", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }
                    : { background: "transparent", color: "var(--text-3)" }}
                >
                  <Icon name={opt.ms} size={18} style={{ color: active ? "var(--accent)" : "var(--text-3)" }} />
                </button>
              );
            })}
          </div>
        </Row>
      </SectionCard>
      <Hint>“System” follows your phone’s light/dark setting. Saved on this device.</Hint>

      {/* Accessibility */}
      <Eyebrow>Accessibility</Eyebrow>
      <SectionCard>
        <Row ms="elderly" title="Senior-friendly mode" subtitle="Show the Emergency SOS button at the top of your home screen">
          <Toggle on={senior} saving={saving} onClick={() => void toggleSenior(!senior)} />
        </Row>
      </SectionCard>
      <Hint>Saved to your account and applies on all your devices.</Hint>

      {/* Account */}
      <Eyebrow>Account</Eyebrow>
      <SectionCard>
        <Row ms="directions_car" title="My vehicles" onClick={() => navigate("/vehicles")}>
          <Icon name="chevron_right" size={21} style={{ color: "var(--text-3)" }} />
        </Row>
      </SectionCard>

      {/* Log out */}
      {user && (
        <button
          onClick={() => void signOut()}
          className="mt-[18px] flex items-center justify-center gap-2 rounded-[14px] p-3.5 text-[15px] font-bold active:opacity-90"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <Icon name="logout" size={20} style={{ color: "var(--danger)" }} /> Log out
        </button>
      )}

      <div className="one-mono mt-3.5 text-center text-[11px]" style={{ color: "var(--text-3)" }}>
        OneRMV · v1.0
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="one-mono mt-[22px] mb-2.5 text-[10px] font-medium uppercase"
      style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}
    >
      {children}
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

// One settings row — accent-soft icon tile + title/subtitle + trailing control.
// `danger` tints the icon tile; `onClick` makes the whole row tappable.
function Row({
  ms,
  title,
  subtitle,
  danger,
  onClick,
  children,
}: {
  ms: string;
  title: string;
  subtitle?: string;
  danger?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const fg = danger ? "var(--danger)" : "var(--accent)";
  const bg = danger ? "var(--danger-soft)" : "var(--accent-soft)";
  const inner = (
    <>
      <span
        className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: bg }}
      >
        <Icon name={ms} size={20} style={{ color: fg }} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-bold" style={{ color: "var(--text)" }}>{title}</span>
        {subtitle && <span className="block text-[12px] leading-snug" style={{ color: "var(--text-3)" }}>{subtitle}</span>}
      </span>
      {children}
    </>
  );
  const cls = "flex w-full items-center gap-3.5 px-3.5 py-3.5 [&:not(:last-child)]:border-b";
  const borderStyle = { borderColor: "var(--border)" } as const;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:opacity-80`} style={borderStyle}>
      {inner}
    </button>
  ) : (
    <div className={cls} style={borderStyle}>
      {inner}
    </div>
  );
}

// OneRMV pill toggle.
function Toggle({ on, saving, onClick }: { on: boolean; saving?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={saving}
      onClick={onClick}
      className="relative flex h-[27px] w-[46px] flex-shrink-0 items-center rounded-full p-[3px] transition-colors disabled:opacity-60"
      style={on ? { background: "var(--accent)" } : { background: "var(--surface-3)", border: "1px solid var(--border)" }}
    >
      <span
        className="h-[21px] w-[21px] rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(19px)" : "translateX(0)" }}
      />
      {saving && <Loader2 size={12} className="absolute right-1.5 animate-spin text-white/80" />}
    </button>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 px-1 text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
      {children}
    </p>
  );
}
