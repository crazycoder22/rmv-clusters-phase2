"use client";

import { useEffect, useRef } from "react";
import {
  playMusic,
  stopMusic,
  sfxReveal,
  sfxFanfare,
  unlockAudio,
} from "@/lib/quiz-audio";

type SessionStatus = "WAITING" | "ACTIVE" | "SHOWING_RESULTS" | "COMPLETED";

interface Props {
  status: SessionStatus | undefined;
  /** Question index the session is currently on. Helps us restart the
   *  question loop from the top when the host advances. */
  currentQuestionIdx?: number;
}

/**
 * Drives background music + key stings on the host screen based on the
 * session state machine. Rendered as a zero-UI component — just
 * listens and plays. Mute toggle lives separately in <QuizMuteToggle>.
 *
 * State map:
 *   WAITING          → lobby music
 *   ACTIVE           → question music (restart on each new question)
 *   SHOWING_RESULTS  → reveal sting, then brief silence
 *   COMPLETED        → victory music (and a one-shot fanfare)
 */
export default function QuizHostAudio({ status, currentQuestionIdx }: Props) {
  // Track the previous status so we can detect TRANSITIONS, which is
  // where the interesting sounds happen (e.g. ACTIVE → SHOWING_RESULTS
  // triggers the reveal sting, not just "while in SHOWING_RESULTS").
  const prevStatus = useRef<SessionStatus | undefined>(undefined);

  useEffect(() => {
    // First render primes the audio context (host almost certainly
    // clicked "Start" or is about to; gesture hooks will unlock audio
    // on the next click regardless).
    unlockAudio();
  }, []);

  useEffect(() => {
    if (!status) return;

    // Detect transitions, not steady-state.
    const prev = prevStatus.current;
    prevStatus.current = status;

    // Transition: ACTIVE → SHOWING_RESULTS → play reveal sting BEFORE
    // changing the music. Short and punchy so it doesn't feel like a
    // dropped call.
    if (prev === "ACTIVE" && status === "SHOWING_RESULTS") {
      sfxReveal();
    }

    // Transition into COMPLETED: fanfare one-shot on top of victory music.
    if (prev !== "COMPLETED" && status === "COMPLETED") {
      sfxFanfare();
    }

    // Steady-state music selection.
    switch (status) {
      case "WAITING":
        playMusic("lobby");
        break;
      case "ACTIVE":
        playMusic("question");
        break;
      case "SHOWING_RESULTS":
        // Soften to lobby-ish music while the leaderboard is on screen.
        // Could also stop entirely; lobby is less awkward than silence.
        playMusic("lobby");
        break;
      case "COMPLETED":
        playMusic("victory");
        break;
    }
  }, [status, currentQuestionIdx]);

  // Stop music when this component unmounts (host closes the session page).
  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, []);

  return null;
}
