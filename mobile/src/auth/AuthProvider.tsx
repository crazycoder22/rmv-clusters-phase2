import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { Preferences } from "@capacitor/preferences";
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "../config";
import { apiFetch } from "../lib/api";
import { unregisterPushNotifications } from "../lib/push-init";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  block: number;
  flatNumber: string;
  imageUrl?: string | null;
  isSeniorCitizen?: boolean;
  dailyStepGoal?: number;
  stepSource?: string | null;
  roles: string[];
  playerId: string;
};

export type SignInErrorReason =
  | "cancelled"
  | "invalid_token"
  | "not_registered"
  | "not_approved"
  | "network"
  | "unknown";

type Session = { user: AuthUser; token: string };

type AuthContextValue = {
  status: "loading" | "signedOut" | "signedIn";
  user: AuthUser | null;
  token: string | null;
  error: { reason: SignInErrorReason; message: string; email?: string } | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "rmv_auth_session_v2";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<AuthContextValue["error"]>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!initializedRef.current) {
          await SocialLogin.initialize({
            google: {
              iOSClientId: GOOGLE_IOS_CLIENT_ID,
              webClientId: GOOGLE_WEB_CLIENT_ID,
            },
          });
          initializedRef.current = true;
        }
        const stored = await Preferences.get({ key: STORAGE_KEY });
        if (cancelled) return;
        if (stored.value) {
          const restored = JSON.parse(stored.value) as Session;
          setSession(restored);
          setStatus("signedIn");
          // Validate the saved JWT in the background. If the server rejects
          // it (expired after 30 days, or otherwise invalid) we clear the
          // session so the app drops to the login screen — instead of
          // appearing "logged in" while every API call 401s (e.g. opening a
          // shared post link showed a dead "Unauthorized"). Network errors
          // are ignored so offline launches keep working from cache.
          void (async () => {
            try {
              const res = await apiFetch("/api/me", { token: restored.token });
              if (!cancelled && res.status === 401) {
                await Preferences.remove({ key: STORAGE_KEY });
                if (cancelled) return;
                setSession(null);
                setError({
                  reason: "invalid_token",
                  message: "Your session expired. Please sign in again.",
                });
                setStatus("signedOut");
              }
            } catch {
              // offline / transient — keep the cached session
            }
          })();
        } else {
          setStatus("signedOut");
        }
      } catch {
        if (cancelled) return;
        setStatus("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);

    let idToken: string | undefined;
    try {
      const res = await SocialLogin.login({
        provider: "google",
        options: {},
      });
      if (res.provider !== "google") {
        throw new Error("Unexpected provider: " + res.provider);
      }
      const r = res.result as { idToken?: string };
      idToken = r.idToken;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel/i.test(msg)) {
        setError({ reason: "cancelled", message: "Sign-in cancelled." });
        return;
      }
      setError({ reason: "unknown", message: msg });
      return;
    }

    if (!idToken) {
      setError({
        reason: "invalid_token",
        message: "Google didn't return an ID token.",
      });
      return;
    }

    let response: Response;
    try {
      response = await apiFetch("/api/auth/mobile", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      });
    } catch (e) {
      setError({
        reason: "network",
        message: e instanceof Error ? e.message : "Network error",
      });
      return;
    }

    if (response.status === 403) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: SignInErrorReason;
        email?: string;
      };
      if (body.error === "not_registered") {
        const who = body.email ? `\n(${body.email})` : "";
        setError({
          reason: "not_registered",
          email: body.email,
          message:
            "This Google account isn't registered in the community." +
            who +
            "\nIf you have multiple Google accounts on this phone, tap Continue with Google again and pick the one your society profile uses.",
        });
        return;
      }
      if (body.error === "not_approved") {
        const who = body.email ? `\n(${body.email})` : "";
        setError({
          reason: "not_approved",
          email: body.email,
          message:
            "Your registration is pending admin approval. Please check back later." +
            who,
        });
        return;
      }
      setError({ reason: "unknown", message: "Access denied." });
      return;
    }

    if (!response.ok) {
      setError({
        reason: response.status === 401 ? "invalid_token" : "unknown",
        message: `Server returned ${response.status}`,
      });
      return;
    }

    const data = (await response.json()) as { token: string; user: AuthUser };
    const next: Session = { token: data.token, user: data.user };
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(next) });
    setSession(next);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async () => {
    // Drop the device token while we still have a JWT to authenticate the
    // DELETE call, otherwise the resident keeps getting pushes after
    // logout.
    try {
      await unregisterPushNotifications(session?.token ?? null);
    } catch {
      // ignore — never block sign-out on a push-cleanup failure
    }
    try {
      await SocialLogin.logout({ provider: "google" });
    } catch {
      // ignore
    }
    await Preferences.remove({ key: STORAGE_KEY });
    setSession(null);
    setStatus("signedOut");
    setError(null);
  }, [session]);

  const updateUser = useCallback(
    async (patch: Partial<AuthUser>) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next: Session = { ...prev, user: { ...prev.user, ...patch } };
        void Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(next) });
        return next;
      });
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        status,
        user: session?.user ?? null,
        token: session?.token ?? null,
        error,
        signIn,
        signOut,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
