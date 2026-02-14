"use client";

import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";

export default function SignInButton() {
  return (
    <button
      onClick={() => signIn("google")}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
    >
      <LogIn size={16} />
      <span>Sign In</span>
    </button>
  );
}
