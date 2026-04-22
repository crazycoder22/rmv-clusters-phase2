"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { getMuted, setMuted, applyMuteToMusic, unlockAudio } from "@/lib/quiz-audio";

// Small floating toggle used by both the host session page and the
// player page. Persists to localStorage and applies the preference to
// the background music element. Also serves as a user-gesture event
// that unlocks the AudioContext for synthesised SFX.
export default function QuizMuteToggle({
  position = "top-right",
  size = "md",
}: {
  position?: "top-right" | "inline";
  size?: "sm" | "md";
}) {
  const [muted, setMutedState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMutedState(getMuted());
    setMounted(true);
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    applyMuteToMusic();
    // Any click is a user gesture — unlock the AudioContext so the next
    // SFX call works even if nothing has played before.
    unlockAudio();
  }

  // Avoid hydration mismatch: render a neutral placeholder until the
  // localStorage value is loaded on the client.
  if (!mounted) return null;

  const iconSize = size === "sm" ? 14 : 18;
  const btnClasses = clsx(
    "flex items-center justify-center rounded-full border transition-colors",
    size === "sm" ? "w-8 h-8" : "w-10 h-10",
    muted
      ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-primary-600 dark:text-primary-400 hover:border-primary-400"
  );

  if (position === "top-right") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? "Unmute quiz audio" : "Mute quiz audio"}
        title={muted ? "Unmute" : "Mute"}
        className={clsx(btnClasses, "fixed top-4 right-4 z-40 shadow-md")}
      >
        {muted ? <VolumeX size={iconSize} /> : <Volume2 size={iconSize} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Unmute quiz audio" : "Mute quiz audio"}
      title={muted ? "Unmute" : "Mute"}
      className={btnClasses}
    >
      {muted ? <VolumeX size={iconSize} /> : <Volume2 size={iconSize} />}
    </button>
  );
}
