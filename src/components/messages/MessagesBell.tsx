"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

// A nav icon linking to /messages with an unread-count badge.
// Polls the cheap unread-count endpoint every 60s (mirrors NotificationBell).
export default function MessagesBell() {
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread-count");
      if (res.ok) setUnread((await res.json()).count ?? 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.isRegistered) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [session, fetchUnread]);

  if (!session?.user?.isRegistered) return null;

  return (
    <Link
      href="/messages"
      className="relative p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors"
      aria-label="Messages"
    >
      <MessageCircle size={20} />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
