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

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  block: number;
  flatNumber: string;
  imageUrl?: string | null;
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
          setSession(JSON.parse(stored.value) as Session);
          setStatus("signedIn");
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
        setError({
          reason: "not_registered",
          email: body.email,
          message:
            "This email isn't registered in the community. Please register on the website first.",
        });
        return;
      }
      if (body.error === "not_approved") {
        setError({
          reason: "not_approved",
          email: body.email,
          message:
            "Your registration is pending admin approval. Please check back later.",
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
    try {
      await SocialLogin.logout({ provider: "google" });
    } catch {
      // ignore
    }
    await Preferences.remove({ key: STORAGE_KEY });
    setSession(null);
    setStatus("signedOut");
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user: session?.user ?? null,
        token: session?.token ?? null,
        error,
        signIn,
        signOut,
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
