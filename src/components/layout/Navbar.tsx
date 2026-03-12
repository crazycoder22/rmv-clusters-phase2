"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Menu, X, ChevronDown, Shield } from "lucide-react";
import clsx from "clsx";
import SignInButton from "@/components/auth/SignInButton";
import UserMenu from "@/components/auth/UserMenu";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useRegistrationGuard } from "@/hooks/useRegistrationGuard";
import {
  canManageAnnouncements,
  canManageResidents,
  canManageVisitors,
  canAccessTasks,
  canManageNewsletters,
} from "@/lib/roles";

const publicPaths = ["/", "/contact"];

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/news", label: "News" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faq", label: "FAQ" },
  { href: "/calendar", label: "Calendar" },
  { href: "/newsletters", label: "Newsletters" },
  { href: "/issues", label: "Issues" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  useRegistrationGuard();

  const isApproved = session?.user?.isApproved;
  const roles = session?.user?.roles ?? [];

  const visibleLinks = session
    ? isApproved
      ? navLinks.filter((l) => l.href !== "/")
      : [] // Hide all nav links for unapproved users
    : navLinks.filter((l) => publicPaths.includes(l.href));

  // Build admin links based on roles
  const adminLinks: { href: string; label: string; match: string | ((p: string) => boolean) }[] = [];

  if (canManageAnnouncements(roles) || canManageResidents(roles)) {
    adminLinks.push({ href: "/admin", label: "Announcements", match: "/admin" });
  }
  if (canManageAnnouncements(roles)) {
    adminLinks.push({
      href: "/admin/calendar",
      label: "Calendar",
      match: (p) => p.startsWith("/admin/calendar"),
    });
    adminLinks.push({
      href: "/accounts/expenses",
      label: "Accounts",
      match: (p) => p.startsWith("/accounts"),
    });
  }
  if (canManageNewsletters(roles)) {
    adminLinks.push({
      href: "/admin/newsletters",
      label: "Newsletters",
      match: (p) => p.startsWith("/admin/newsletters"),
    });
  }
  if (canManageVisitors(roles)) {
    adminLinks.push({ href: "/visitors", label: "Visitors", match: "/visitors" });
  }
  if (canAccessTasks(roles)) {
    adminLinks.push({ href: "/tasks", label: "Tasks", match: "/tasks" });
  }

  const isAdminActive = adminLinks.some((link) => {
    if (typeof link.match === "function") return link.match(pathname);
    return pathname === link.match;
  });

  // Close admin dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        adminDropdownRef.current &&
        !adminDropdownRef.current.contains(e.target as Node)
      ) {
        setAdminOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close admin dropdown on route change
  useEffect(() => {
    setAdminOpen(false);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="font-bold text-xl text-primary-800">
            RMV Clusters
          </Link>

          {/* Desktop links + auth */}
          <div className="hidden md:flex items-center gap-1">
            {session?.user?.isRegistered && session?.user?.isApproved && (
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

            {/* Admin Dropdown */}
            {adminLinks.length > 0 && (
              <div className="relative" ref={adminDropdownRef}>
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  className={clsx(
                    "flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isAdminActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                  )}
                >
                  <Shield size={15} />
                  Admin
                  <ChevronDown
                    size={14}
                    className={clsx(
                      "transition-transform",
                      adminOpen && "rotate-180"
                    )}
                  />
                </button>

                {adminOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {adminLinks.map((link) => {
                      const active =
                        typeof link.match === "function"
                          ? link.match(pathname)
                          : pathname === link.match;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={clsx(
                            "block px-4 py-2 text-sm transition-colors",
                            active
                              ? "bg-primary-50 text-primary-700 font-medium"
                              : "text-gray-700 hover:bg-gray-50 hover:text-primary-700"
                          )}
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
            {session?.user?.isRegistered && session?.user?.isApproved && (
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

            {/* Mobile Admin Section */}
            {adminLinks.length > 0 && (
              <>
                <div className="border-t mt-2 pt-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Shield size={12} />
                    Admin
                  </p>
                </div>
                {adminLinks.map((link) => {
                  const active =
                    typeof link.match === "function"
                      ? link.match(pathname)
                      : pathname === link.match;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={clsx(
                        "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                        active
                          ? "bg-primary-50 text-primary-700"
                          : "text-gray-600 hover:text-primary-700 hover:bg-primary-50"
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </>
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
                      signOut({ callbackUrl: "/" });
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
