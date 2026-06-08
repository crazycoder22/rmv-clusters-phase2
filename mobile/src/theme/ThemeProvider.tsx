import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Preferences } from "@capacitor/preferences";

export type ThemePref = "light" | "dark" | "system";
const STORAGE_KEY = "rmv_theme_v1";

type ThemeCtx = {
  theme: ThemePref;
  isDark: boolean;
  setTheme: (t: ThemePref) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

function resolveIsDark(pref: ThemePref): boolean {
  return pref === "system" ? systemPrefersDark() : pref === "dark";
}

function applyClass(isDark: boolean) {
  const el = document.documentElement;
  el.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to dark (the app's existing look) until the stored pref loads.
  const [theme, setThemeState] = useState<ThemePref>("dark");
  const [isDark, setIsDark] = useState(true);

  // Load saved preference once.
  useEffect(() => {
    let cancelled = false;
    Preferences.get({ key: STORAGE_KEY }).then(({ value }) => {
      if (cancelled) return;
      const pref = (value as ThemePref) || "dark";
      const dark = resolveIsDark(pref);
      setThemeState(pref);
      setIsDark(dark);
      applyClass(dark);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep in sync with system changes when in "system" mode.
  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const dark = mq.matches;
      setIsDark(dark);
      applyClass(dark);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemePref) => {
    const dark = resolveIsDark(t);
    setThemeState(t);
    setIsDark(dark);
    applyClass(dark);
    void Preferences.set({ key: STORAGE_KEY, value: t });
  }, []);

  return <Ctx.Provider value={{ theme, isDark, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
