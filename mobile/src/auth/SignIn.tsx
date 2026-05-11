import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function SignIn() {
  const { signIn, error } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch {
      // surfaced via useAuth().error
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-between px-6 pt-[max(3rem,env(safe-area-inset-top,0px))] pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-6xl">🏘️</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          OneRMV
        </h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-500">
          RMV Clusters Phase 2
        </p>
        <p className="mt-3 max-w-xs text-sm text-slate-400">
          Sign in to access community games, events, and more.
        </p>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 shadow-lg active:scale-[0.98] disabled:opacity-60"
        >
          <GoogleG />
          {busy ? "Signing in…" : "Continue with Google"}
        </button>

        {error && error.reason !== "cancelled" && (
          <p className="text-center text-xs text-red-400">{error.message}</p>
        )}

        <p className="text-center text-[11px] text-slate-500">
          By continuing, you agree to the community guidelines.
        </p>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.836.859-3.048.859-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.441 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
