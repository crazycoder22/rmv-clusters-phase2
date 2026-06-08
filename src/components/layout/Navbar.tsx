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
import MessagesBell from "@/components/messages/MessagesBell";
import MedalsChip from "@/components/medals/MedalsChip";
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
  canIssueStickers,
  isAdmin,
  isSuperAdmin,
} from "@/lib/roles";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; links: NavLink[] };
type NavItem = NavLink | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return "links" in item;
}

// Pages that show up in the navbar for unauthenticated visitors. The pages
// themselves enforce their own auth (or don't, for genuinely public ones).
const publicPaths = ["/", "/contact", "/videos", "/surveys", "/faq"];

// Top-level links shown directly in the navbar
const topLevelLinks: NavLink[] = [
  { href: "/news", label: "News" },
  { href: "/calendar", label: "Calendar" },
  { href: "/habits", label: "Habits" },
];

// Grouped dropdown links
const navGroups: NavGroup[] = [
  {
    label: "Games",
    links: [
      { href: "/wordle", label: "Wordle" },
      { href: "/anagram", label: "Anagram" },
      { href: "/sudoku", label: "Sudoku" },
      { href: "/crossword", label: "Crossword" },
      { href: "/memory", label: "Memory" },
      { href: "/memory/multi", label: "Memory Multi-player" },
      { href: "/2048", label: "2048" },
      { href: "/quiz", label: "Quiz" },
      { href: "/tambola", label: "Tambola" },
      { href: "/fantasy", label: "Fantasy Cricket" },
    ],
  },
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
      { href: "/groups", label: "Groups" },
      { href: "/initiatives", label: "Initiatives" },
      { href: "/referendums", label: "Referendums" },
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
      { href: "/food", label: "Food" },
      { href: "/parking", label: "Parking" },
      { href: "/vehicles", label: "My Vehicles" },
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

  // Build admin nav items grouped by theme. Each group contains links
  // gated by individual role checks; groups with zero visible links are
  // filtered out so the dropdown only shows sections the user can use.
  type AdminLink = {
    href: string;
    label: string;
    match: string | ((p: string) => boolean);
  };
  type AdminGroup = { label: string; links: AdminLink[] };

  const adminGroups: AdminGroup[] = [];

  // ── Community ─────────────────────────────────────────────────────────
  const communityLinks: AdminLink[] = [];
  if (canManageAnnouncements(roles) || canManageResidents(roles)) {
    communityLinks.push({ href: "/admin", label: "Announcements", match: "/admin" });
  }
  if (canManageNewsletters(roles)) {
    communityLinks.push({
      href: "/admin/newsletters",
      label: "Newsletters",
      match: (p) => p.startsWith("/admin/newsletters"),
    });
  }
  if (canManageAnnouncements(roles)) {
    communityLinks.push({
      href: "/admin/videos",
      label: "Video Library",
      match: (p) => p.startsWith("/admin/videos"),
    });
  }
  if (canManageAds(roles)) {
    communityLinks.push({
      href: "/admin/ads",
      label: "Banner Ads",
      match: (p) => p.startsWith("/admin/ads"),
    });
  }
  if (communityLinks.length) adminGroups.push({ label: "Community", links: communityLinks });

  // ── Residents & Access ────────────────────────────────────────────────
  const residentLinks: AdminLink[] = [];
  if (isAdmin(roles)) {
    residentLinks.push({
      href: "/admin/residents",
      label: "Residents",
      match: (p) => p.startsWith("/admin/residents"),
    });
  }
  if (canManageVisitors(roles)) {
    residentLinks.push({ href: "/visitors", label: "Visitors", match: "/visitors" });
  }
  if (isAdmin(roles)) {
    residentLinks.push({
      href: "/admin/visits",
      label: "Visit Log",
      match: (p) => p.startsWith("/admin/visits"),
    });
  }
  if (isAdmin(roles)) {
    residentLinks.push({
      href: "/admin/occupancy",
      label: "Occupancy",
      match: (p) => p.startsWith("/admin/occupancy"),
    });
  }
  if (canManageAnnouncements(roles)) {
    residentLinks.push({
      href: "/admin/sos-acceptances",
      label: "SOS Acceptances",
      match: (p) => p.startsWith("/admin/sos-acceptances"),
    });
  }
  if (canIssueStickers(roles)) {
    // Facility managers also get this link, even though they can't see
    // other entries in the "Residents & Access" group.
    residentLinks.push({
      href: "/admin/stickers",
      label: "Vehicle Stickers",
      match: (p) => p.startsWith("/admin/stickers"),
    });
  }
  if (residentLinks.length) adminGroups.push({ label: "Residents & Access", links: residentLinks });

  // ── Events ────────────────────────────────────────────────────────────
  const eventLinks: AdminLink[] = [];
  if (canManageAnnouncements(roles)) {
    eventLinks.push({
      href: "/admin/calendar",
      label: "Calendar",
      match: (p) => p.startsWith("/admin/calendar"),
    });
  }
  if (canManageMeetings(roles)) {
    eventLinks.push({
      href: "/admin/meetings",
      label: "Meetings",
      match: (p) => p.startsWith("/admin/meetings"),
    });
  }
  if (canManageAnnouncements(roles)) {
    eventLinks.push({
      href: "/admin/public-events",
      label: "Public Events",
      match: (p) => p.startsWith("/admin/public-events"),
    });
    eventLinks.push({
      href: "/admin/tambola",
      label: "Tambola",
      match: (p) => p.startsWith("/admin/tambola"),
    });
  }
  if (eventLinks.length) adminGroups.push({ label: "Events", links: eventLinks });

  // ── Games ─────────────────────────────────────────────────────────────
  const gameLinks: AdminLink[] = [];
  if (canManageAnnouncements(roles)) {
    gameLinks.push({
      href: "/admin/quiz",
      label: "Quiz",
      match: (p) => p.startsWith("/admin/quiz"),
    });
    gameLinks.push({
      href: "/admin/fantasy",
      label: "Fantasy Cricket",
      match: (p) => p.startsWith("/admin/fantasy"),
    });
    gameLinks.push({
      href: "/admin/medals",
      label: "Medals & Coins",
      match: (p) => p.startsWith("/admin/medals"),
    });
  }
  if (gameLinks.length) adminGroups.push({ label: "Games", links: gameLinks });

  // ── Tasks & Docs ──────────────────────────────────────────────────────
  const taskLinks: AdminLink[] = [];
  if (canAccessTasks(roles)) {
    taskLinks.push({ href: "/tasks", label: "Tasks", match: "/tasks" });
  }
  if (canManageChecklist(roles)) {
    taskLinks.push({
      href: "/admin/checklist",
      label: "Checklist Items",
      match: (p) => p.startsWith("/admin/checklist"),
    });
  }
  if (canAccessTasks(roles)) {
    taskLinks.push({
      href: "/admin/duties",
      label: "Staff Duties",
      match: (p) => p.startsWith("/admin/duties"),
    });
    taskLinks.push({ href: "/duties", label: "My Duties", match: "/duties" });
  }
  if (canManageDocuments(roles)) {
    taskLinks.push({
      href: "/admin/documents",
      label: "Documents",
      match: (p) => p.startsWith("/admin/documents"),
    });
  }
  if (canManageReviewDocs(roles)) {
    taskLinks.push({
      href: "/admin/review-docs",
      label: "Review Docs",
      match: (p) => p.startsWith("/admin/review-docs"),
    });
  }
  if (taskLinks.length) adminGroups.push({ label: "Tasks & Docs", links: taskLinks });

  // ── Engagement ────────────────────────────────────────────────────────
  const engagementLinks: AdminLink[] = [];
  if (canManagePolls(roles)) {
    engagementLinks.push({
      href: "/admin/polls/new",
      label: "Polls",
      match: (p) => p.startsWith("/admin/polls"),
    });
    engagementLinks.push({
      href: "/admin/surveys/new",
      label: "Surveys",
      match: (p) => p.startsWith("/admin/surveys"),
    });
  }
  if (engagementLinks.length) adminGroups.push({ label: "Engagement", links: engagementLinks });

  // ── Finance & Facility ────────────────────────────────────────────────
  const financeLinks: AdminLink[] = [];
  if (canManageAnnouncements(roles)) {
    financeLinks.push({
      href: "/accounts/expenses",
      label: "Accounts",
      match: (p) => p.startsWith("/accounts"),
    });
    financeLinks.push({
      href: "/admin/housekeeping",
      label: "Housekeeping",
      match: (p) => p.startsWith("/admin/housekeeping"),
    });
  }
  if (isAdmin(roles) || (roles ?? []).includes("FACILITY_MANAGER")) {
    financeLinks.push({
      href: "/admin/mygate-complaints",
      label: "MyGate Complaints",
      match: (p) => p.startsWith("/admin/mygate-complaints"),
    });
  }
  if (financeLinks.length) adminGroups.push({ label: "Finance & Facility", links: financeLinks });

  // Flat list — used for the "is any admin section active?" check and
  // the "should the Admin button appear at all?" check.
  const allAdminLinks = adminGroups.flatMap((g) => g.links);
  const isAdminActive = allAdminLinks.some((link) =>
    typeof link.match === "function" ? link.match(pathname) : pathname === link.match
  );

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
            {allAdminLinks.length > 0 && (
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
                  // w-56 fits "SOS Acceptances" without truncation;
                  // max-h caps height at 75vh (with internal scroll) so
                  // the dropdown never exceeds the viewport even when
                  // the user zooms in or the browser window is small.
                  <div className="absolute right-0 mt-1 w-56 max-h-[75vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    {adminGroups.map((group, gIdx) => (
                      <div key={group.label}>
                        {gIdx > 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                        )}
                        <p className="px-4 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          {group.label}
                        </p>
                        {group.links.map((link) => {
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
                    ))}
                  </div>
                )}
              </div>
            )}

            <ThemeToggle />
            <MessagesBell />
            <NotificationBell />
            <MedalsChip />
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

            {/* Mobile Admin Section — grouped same as desktop, with a
                single "Admin" header at the top followed by each
                group's label as a smaller subheading. */}
            {allAdminLinks.length > 0 && (
              <>
                <div className="border-t dark:border-gray-700 mt-2 pt-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Shield size={12} />
                    Admin
                  </p>
                </div>
                {adminGroups.map((group) => (
                  <div key={group.label}>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {group.label}
                    </p>
                    {group.links.map((link) => {
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
                  </div>
                ))}
              </>
            )}

            <div className="border-t dark:border-gray-700 mt-2 pt-2 flex items-center justify-between gap-2">
              <ThemeToggle />
              <div className="flex items-center gap-2">
                <MessagesBell />
                <NotificationBell />
                <MedalsChip />
              </div>
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
