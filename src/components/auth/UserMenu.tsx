"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import Image from "next/image";

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!session?.user) return null;

  const firstName = session.user.name?.split(" ")[0] ?? "User";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
      >
        {session.user.image && (
          <Image
            src={session.user.image}
            alt=""
            width={24}
            height={24}
            className="rounded-full"
          />
        )}
        <span>{firstName}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border py-1 z-50">
          <div className="px-4 py-2 border-b">
            <p className="text-sm font-medium text-gray-900">
              {session.user.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {session.user.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
