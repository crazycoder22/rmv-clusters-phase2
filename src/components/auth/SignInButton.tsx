"use client";

import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";

export default function SignInButton() {
  const handleSignIn = () => {
    // Return to the page the user is currently on after Google OAuth,
    // falling back to home if we can't read the location (SSR edge case).
    const callbackUrl =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
    signIn("google", { callbackUrl });
  };
  return (
    <button
      onClick={handleSignIn}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/50 transition-colors"
    >
      <LogIn size={16} />
      <span>Sign In</span>
    </button>
  );
}
