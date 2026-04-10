"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Menu, X, ChevronDown, Shield } from "lucide-react";
import clsx from "clsx";
import SignInButton from "@/components/auth/SignInButton";
import UserMenu from "@/components/auth/UserMenu";
import NotificationBell from "@/components/notifications/NotificationBell";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useRegistrationGuard } from "@/hooks/useRegistrationGuard";
import {
  canManageAnnouncements,
  canManageResidents,
  canManageVisitors,
  canAccessTasks,
  canManageNewsletters,
  canManageChecklist,
  canFillChecklist,
  canManageDocuments,
  canManageMeetings,
  canManageReviewDocs,
  canManagePolls,
  canManageAds,
  isSuperAdmin,
} from "@/lib/roles";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; links: NavLink[] };
type NavItem = NavLink | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return "links" in item;
}

const publicPaths = ["/", "/contact", "/wordle", "/sudoku", "/crossword", "/tambola", "/videos", "/surveys"];

// Top-level links shown directly in the navbar
const topLevelLinks: NavLink[] = [
  { href: "/news", label: "News" },
  { href: "/calendar", label: "Calendar" },
  { href: "/fantasy", label: "Fantasy" },
  { href: "/wordle", label: "Wordle" },
  { href: "/sudoku", label: "Sudoku" },
  { href: "/crossword", label: "Crossword" },
  { href: "/tambola", label: "Tambola" },
];

// Grouped dropdown links
const navGroups: NavGroup[] = [
  {
    label: "Info",
    links: [
      { href: "/guidelines", label: "Guidelines" },
      { href: "/sos-guidelines", label: "SOS" },
      { href: "/faq", label: "FAQ" },
      { href: "/gallery", label: "Gallery" },
      { href: "/newsletters", label: "Newsletters" },
      { href: "/videos", label: "Videos" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    label: "Community",
    links: [
      { href: "/community", label: "Community" },
      { href: "/issues", label: "Issues" },
      { href: "/polls", label: "Polls" },
      { href: "/review-docs", label: "Reviews" },
      { href: "/visits", label: "Visits" },
    ],
  },
  {
    label: "Services",
    links: [
      { href: "/marketplace", label: "Marketplace" },
      { href: "/domestic-help", label: "Domestic Help" },
      { href: "/documents", label: "Documents" },
      { href: "/checklist", label: "Checklist" },
      { href: "/housekeeping/feedback", label: "Housekeeping" },
    ],
  },
];

// Combined ordered nav items for desktop
const navItems: NavItem[] = [
  ...topLevelLinks,
  ...navGroups,
];

// All link hrefs for filtering by auth
const allLinkHrefs = [
  ...topLevelLinks.map((l) => l.href),
  ...navGroups.flatMap((g) => g.links.map((l) => l.href)),
];

function NavDropdown({
  group,
  pathname,
  openDropdown,
  setOpenDropdown,
}: {
  group: NavGroup;
  pathname: string;
  openDropdown: string | null;
  setOpenDropdown: (name: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isOpen = openDropdown === group.label;
  const isActive = group.links.some((l) => pathname === l.href || pathname.startsWith(l.href + "/"));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (isOpen) setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setOpenDropdown]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpenDropdown(isOpen ? null : group.label)}
        className={clsx(
          "flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
            : "text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
        )}
      >
        {group.label}
        <ChevronDown
          size={14}
          className={clsx("transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          {group.links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "block px-4 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/50 dark:text-primary-300"
                    : "text-gray-700 hover:bg-gray-50 hover:text-primary-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-primary-300"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  useRegistrationGuard();

  const isApproved = session?.user?.isApproved;
  const roles = session?.user?.roles ?? [];
  const isLoggedIn = !!session;
  const isFullAccess = isLoggedIn && isApproved;

  // Links hidden from everyone except superadmins
  const superAdminOnlyPaths = ["/community", "/documents", "/checklist"];
  const isSuperAdminUser = isSuperAdmin(roles);

  // Filter which links are visible based on auth state
  const isLinkVisible = useCallback(
    (href: string) => {
      if (!isLoggedIn) return publicPaths.includes(href);
      if (!isFullAccess) return false;
      if (superAdminOnlyPaths.includes(href) && !isSuperAdminUser) return false;
      return href !== "/"; // Hide Home for logged-in users
    },
    [isLoggedIn, isFullAccess, isSuperAdminUser]
  );

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
  if (canManageAds(roles)) {
    adminLinks.push({
      href: "/admin/ads",
      label: "Banner Ads",
      match: (p) => p.startsWith("/admin/ads"),
    });
  }
  if (canManageVisitors(roles)) {
    adminLinks.push({ href: "/visitors", label: "Visitors", match: "/visitors" });
  }
  if (canAccessTasks(roles)) {
    adminLinks.push({ href: "/tasks", label: "Tasks", match: "/tasks" });
  }
  if (canManageChecklist(roles)) {
    adminLinks.push({
      href: "/admin/checklist",
      label: "Checklist Items",
      match: (p) => p.startsWith("/admin/checklist"),
    });
  }
  if (canManageDocuments(roles)) {
    adminLinks.push({
      href: "/admin/documents",
      label: "Documents",
      match: (p) => p.startsWith("/admin/documents"),
    });
  }
  if (canManageMeetings(roles)) {
    adminLinks.push({
      href: "/admin/meetings",
      label: "Meetings",
      match: (p) => p.startsWith("/admin/meetings"),
    });
  }
  if (canManageReviewDocs(roles)) {
    adminLinks.push({
      href: "/admin/review-docs",
      label: "Review Docs",
      match: (p) => p.startsWith("/admin/review-docs"),
    });
  }
  if (canManagePolls(roles)) {
    adminLinks.push({
      href: "/admin/polls/new",
      label: "Polls",
      match: (p) => p.startsWith("/admin/polls"),
    });
    adminLinks.push({
      href: "/admin/surveys/new",
      label: "Surveys",
      match: (p) => p.startsWith("/admin/surveys"),
    });
  }
  if (canManageAnnouncements(roles)) {
    adminLinks.push({
      href: "/admin/sos-acceptances",
      label: "SOS Acceptances",
      match: (p) => p.startsWith("/admin/sos-acceptances"),
    });
    adminLinks.push({
      href: "/admin/fantasy",
      label: "Fantasy Cricket",
      match: (p) => p.startsWith("/admin/fantasy"),
    });
    adminLinks.push({
      href: "/admin/housekeeping",
      label: "Housekeeping",
      match: (p) => p.startsWith("/admin/housekeeping"),
    });
    adminLinks.push({
      href: "/admin/videos",
      label: "Video Library",
      match: (p) => p.startsWith("/admin/videos"),
    });
    adminLinks.push({
      href: "/admin/tambola",
      label: "Tambola",
      match: (p) => p.startsWith("/admin/tambola"),
    });
  }

  const isAdminActive = adminLinks.some((link) => {
    if (typeof link.match === "function") return link.match(pathname);
    return pathname === link.match;
  });

  // Close all dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        adminDropdownRef.current &&
        !adminDropdownRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown((prev) => (prev === "admin" ? null : prev));
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close all dropdowns on route change
  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-sm dark:shadow-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="font-bold text-xl text-primary-800 dark:text-primary-200 shrink-0">
            RMV Clusters
          </Link>

          {/* Desktop links + auth */}
          <div className="hidden lg:flex items-center gap-1">
            {isFullAccess && (
              <Link
                href="/dashboard"
                className={clsx(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === "/dashboard"
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                    : "text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
                )}
              >
                Dashboard
              </Link>
            )}

            {navItems.map((item) => {
              if (isGroup(item)) {
                // Filter group links by visibility
                const visibleGroupLinks = item.links.filter((l) => isLinkVisible(l.href));
                if (visibleGroupLinks.length === 0) return null;
                const filteredGroup = { ...item, links: visibleGroupLinks };
                return (
                  <NavDropdown
                    key={item.label}
                    group={filteredGroup}
                    pathname={pathname}
                    openDropdown={openDropdown}
                    setOpenDropdown={setOpenDropdown}
                  />
                );
              }
              // Top-level link
              if (!isLinkVisible(item.href)) return null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                      : "text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* Admin Dropdown */}
            {adminLinks.length > 0 && (
              <div className="relative" ref={adminDropdownRef}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === "admin" ? null : "admin")}
                  className={clsx(
                    "flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isAdminActive
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                      : "text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
                  )}
                >
                  <Shield size={15} />
                  Admin
                  <ChevronDown
                    size={14}
                    className={clsx(
                      "transition-transform",
                      openDropdown === "admin" && "rotate-180"
                    )}
                  />
                </button>

                {openDropdown === "admin" && (
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
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
                              ? "bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/50 dark:text-primary-300"
                              : "text-gray-700 hover:bg-gray-50 hover:text-primary-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-primary-300"
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

            <ThemeToggle />
            <NotificationBell />
            <div className="ml-2 border-l border-gray-200 dark:border-gray-700 pl-2">
              {session ? <UserMenu /> : <SignInButton />}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-md text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white dark:bg-gray-900 border-t dark:border-gray-700 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-2 space-y-1">
            {isFullAccess && (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                  pathname === "/dashboard"
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                    : "text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
                )}
              >
                Dashboard
              </Link>
            )}

            {/* Top-level links */}
            {topLevelLinks
              .filter((l) => isLinkVisible(l.href))
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                    pathname === link.href
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                      : "text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
                  )}
                >
                  {link.label}
                </Link>
              ))}

            {/* Grouped sections */}
            {navGroups.map((group) => {
              const visibleGroupLinks = group.links.filter((l) => isLinkVisible(l.href));
              if (visibleGroupLinks.length === 0) return null;
              return (
                <div key={group.label}>
                  <div className="border-t dark:border-gray-700 mt-2 pt-2">
                    <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {group.label}
                    </p>
                  </div>
                  {visibleGroupLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={clsx(
                        "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                        pathname === link.href || pathname.startsWith(link.href + "/")
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                          : "text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              );
            })}

            {/* Mobile Admin Section */}
            {adminLinks.length > 0 && (
              <>
                <div className="border-t dark:border-gray-700 mt-2 pt-2">
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
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                          : "text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </>
            )}

            <div className="border-t dark:border-gray-700 mt-2 pt-2 flex items-center justify-between">
              <ThemeToggle />
              <NotificationBell />
            </div>
            <div className="border-t dark:border-gray-700 mt-2 pt-2">
              {session ? (
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {session.user?.name}
                  </p>
                  <button
                    onClick={() => {
                      signOut({ callbackUrl: "/" });
                      setMobileOpen(false);
                    }}
                    className="mt-1 text-sm text-gray-600 hover:text-primary-700 dark:text-gray-400 dark:hover:text-primary-300"
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
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/50"
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
