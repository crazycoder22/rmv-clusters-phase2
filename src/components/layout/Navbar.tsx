"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import SignInButton from "@/components/auth/SignInButton";
import UserMenu from "@/components/auth/UserMenu";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useRegistrationGuard } from "@/hooks/useRegistrationGuard";

const publicPaths = ["/", "/contact"];

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/news", label: "News" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  useRegistrationGuard();

  const visibleLinks = session
    ? navLinks
    : navLinks.filter((l) => publicPaths.includes(l.href));

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="font-bold text-xl text-primary-800">
            RMV Clusters
          </Link>

          {/* Desktop links + auth */}
          <div className="hidden md:flex items-center gap-1">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                )}
              >
                {link.label}
              </Link>
            ))}
            {session?.user?.isRegistered && (
              <Link
                href="/dashboard"
                className={clsx(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === "/dashboard"
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                )}
              >
                Dashboard
              </Link>
            )}
            {(session?.user?.role === "SUPERADMIN" || session?.user?.role === "ADMIN") && (
              <Link
                href="/admin"
                className={clsx(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === "/admin"
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                )}
              >
                Admin
              </Link>
            )}
            <NotificationBell />
            <div className="ml-2 border-l pl-2">
              {session ? <UserMenu /> : <SignInButton />}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-primary-700 hover:bg-primary-50"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-2 space-y-1">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                  pathname === link.href
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                )}
              >
                {link.label}
              </Link>
            ))}
            {session?.user?.isRegistered && (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                  pathname === "/dashboard"
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                )}
              >
                Dashboard
              </Link>
            )}
            {(session?.user?.role === "SUPERADMIN" || session?.user?.role === "ADMIN") && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                  pathname === "/admin"
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                )}
              >
                Admin
              </Link>
            )}
            <div className="border-t mt-2 pt-2 flex items-center justify-between">
              <NotificationBell />
            </div>
            <div className="border-t mt-2 pt-2">
              {session ? (
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">
                    {session.user?.name}
                  </p>
                  <button
                    onClick={() => {
                      signOut();
                      setMobileOpen(false);
                    }}
                    className="mt-1 text-sm text-gray-600 hover:text-primary-700"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    signIn("google");
                    setMobileOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
