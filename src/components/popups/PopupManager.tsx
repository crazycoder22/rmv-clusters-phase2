"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import RichText from "@/components/ui/RichText";

interface PopupData {
  id: string;
  title: string;
  message: string;
}

export default function PopupManager() {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchPopup() {
      try {
        const res = await fetch("/api/popups");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.popup) return;

        // Check if already dismissed
        const key = `popup_seen_${data.popup.id}`;
        if (localStorage.getItem(key)) return;

        setPopup(data.popup);
        // Small delay so the page renders first, then popup animates in
        setTimeout(() => setVisible(true), 500);
      } catch {
        // silently fail
      }
    }
    fetchPopup();
  }, []);

  const dismiss = () => {
    if (popup) {
      localStorage.setItem(`popup_seen_${popup.id}`, "true");
    }
    setVisible(false);
    setTimeout(() => setPopup(null), 300); // wait for fade out
  };

  if (!popup) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) dismiss(); }}
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "bg-black/50 backdrop-blur-sm opacity-100" : "bg-black/0 opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 ${
          visible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        }`}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="p-6 pt-5">
          {/* Title */}
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 pr-8 mb-3">
            {popup.title}
          </h2>

          {/* Message (rich text) */}
          <RichText
            text={popup.message}
            className="text-gray-600 dark:text-gray-400 text-sm"
          />

          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className="mt-5 w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
