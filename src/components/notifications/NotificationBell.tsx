"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import type { NotificationType } from "@/types";
import { getNotificationUrl, getCategoryColor } from "@/lib/notifications";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // silently fail
    }
  }, []);

  // Fetch full notification list
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll unread count on mount + every 60s
  useEffect(() => {
    if (!session?.user?.isRegistered) return;

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [session, fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Only render for registered residents
  if (!session?.user?.isRegistered) return null;

  const handleNotificationClick = async (notification: NotificationType) => {
    // Mark as read
    if (!notification.read) {
      try {
        await fetch("/api/notifications/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // silently fail
      }
    }

    // Navigate and close
    setOpen(false);
    const url = getNotificationUrl(
      notification.announcementId ?? null,
      notification.visitorId ?? null,
      notification.issueId ?? null,
      notification.taskId ?? null,
      notification.postId ?? null,
      notification.reviewDocId ?? null,
      notification.pollId ?? null,
      notification.surveyId ?? null,
      notification.marketplaceListingId ?? null,
      notification.medalAwardId ?? null
    );
    router.push(url);
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                Loading...
              </p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                No notifications
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    !n.read ? "bg-blue-50/50 dark:bg-blue-900/20 border-l-2 border-l-blue-400 dark:border-l-blue-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm leading-snug ${
                        !n.read
                          ? "font-medium text-gray-900 dark:text-gray-100"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {n.medalAward
                        ? (n.message ||
                            `🏆 ${n.medalAward.tier} medal in ${n.medalAward.game} (+${n.medalAward.coins} coins)`)
                        : n.medalAwardId
                        ? (n.message || "An award you received was removed")
                        : n.announcement
                        ? n.announcement.title
                        : n.visitor
                        ? `${n.visitor.name} wants to visit your flat`
                        : n.issue
                        ? `Issue: ${n.issue.title} (${n.issue.status})`
                        : n.task
                        ? `Task: ${n.task.title} (${n.task.status})`
                        : n.post
                        ? (n.message || "New activity on your post")
                        : n.reviewDoc
                        ? (n.message || `Review: ${n.reviewDoc.title}`)
                        : n.marketplaceListing
                        ? (n.message || `Listing: ${n.marketplaceListing.title}`)
                        : n.survey
                        ? (n.message || `Survey: ${n.survey.title}`)
                        : n.poll
                        ? (n.message || `Poll: ${n.poll.title}`)
                        : (n.message || "Notification")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${getCategoryColor(
                        n.medalAward || n.medalAwardId
                          ? "medal"
                          : n.announcement?.category ?? (n.marketplaceListing ? "marketplace" : n.survey ? "poll" : n.poll ? "poll" : n.reviewDoc ? "review" : n.post ? "community" : n.task ? "task" : n.issue ? "issue" : n.message ? "update" : "visitor")
                      )}`}
                    >
                      {n.medalAward || n.medalAwardId
                        ? "medal"
                        : n.announcement?.category ?? (n.marketplaceListing ? "marketplace" : n.survey ? "survey" : n.poll ? "poll" : n.reviewDoc ? "review" : n.post ? "community" : n.task ? "task" : n.issue ? "issue" : n.message ? "update" : "visitor")}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
