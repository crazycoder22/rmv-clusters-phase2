// Quiz audio layer.
//
// We intentionally split the audio into two halves so one half can fail
// gracefully without taking the other with it:
//
//   1. Sound effects (tap / correct / wrong / tick / fanfare) are
//      synthesised with the Web Audio API. Zero files, zero network.
//      Works instantly once a user gesture has unlocked the audio
//      context (iOS Safari + Chrome autoplay policy).
//
//   2. Background music is loaded from /public/audio/quiz/*.mp3. If a
//      file 404s, the music layer stays silent and SFX continue to
//      work. This lets us ship the feature even before the admin has
//      dropped in the matched Bollywood-night tracks.

// ── Mute preference (persists across reloads) ────────────────────────────

const MUTE_KEY = "quizAudio.muted.v1";

export function getMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

// ── AudioContext lifecycle ───────────────────────────────────────────────

let ctx: AudioContext | null = null;

/**
 * Returns a shared AudioContext, creating it lazily. Must be called from
 * a user-gesture handler the first time (click, keydown, touchend) so
 * modern browsers allow playback. Subsequent calls are no-ops.
 */
function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      // Some TS lib configs don't have webkitAudioContext on window; use `any`
      // narrowly to access the Safari fallback.
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = W.AudioContext ?? W.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === "suspended") {
    // Best-effort; browsers only honour this in a user-gesture call stack.
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Call this inside a user-gesture handler (e.g. "Start Quiz" click) so
 *  iOS Safari and modern Chrome unlock the audio context before we need
 *  to play anything. Safe to call multiple times. */
export function unlockAudio(): void {
  getContext();
}

// ── Synthesised SFX ──────────────────────────────────────────────────────
//
// Each SFX is built from one or more gain-modulated oscillators. They're
// kept short (under 500ms) and gentle (peak gain 0.2) so they don't
// startle anyone wearing headphones.

function tone(
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = "sine",
  peakGain = 0.2
): void {
  const c = getContext();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + startOffset);
  // Gentle attack/release envelope — no click on start/stop.
  gain.gain.setValueAtTime(0, c.currentTime + startOffset);
  gain.gain.linearRampToValueAtTime(peakGain, c.currentTime + startOffset + 0.01);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    c.currentTime + startOffset + duration
  );
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + startOffset);
  osc.stop(c.currentTime + startOffset + duration + 0.05);
}

/** Pleasant two-note ascending chime — "you got it right". */
export function sfxCorrect(): void {
  if (getMuted()) return;
  tone(659.25, 0, 0.18, "sine", 0.22); // E5
  tone(987.77, 0.1, 0.25, "sine", 0.2); // B5
}

/** Soft descending chime — "close, but no". Not harsh. */
export function sfxWrong(): void {
  if (getMuted()) return;
  tone(392, 0, 0.18, "sine", 0.2); // G4
  tone(261.63, 0.1, 0.35, "sine", 0.18); // C4
}

/** Very short UI tap — used when the player locks in an answer. */
export function sfxTap(): void {
  if (getMuted()) return;
  tone(880, 0, 0.05, "triangle", 0.12);
}

/** Single countdown tick — can be called every second at the end of a
 *  question for tension. Kept very subtle. */
export function sfxTick(): void {
  if (getMuted()) return;
  tone(1200, 0, 0.04, "square", 0.07);
}

/** Arpeggiated fanfare for game-over. Roughly a C major triad played
 *  fast, no samples needed. */
export function sfxFanfare(): void {
  if (getMuted()) return;
  tone(523.25, 0, 0.16, "triangle", 0.22); // C5
  tone(659.25, 0.12, 0.16, "triangle", 0.22); // E5
  tone(783.99, 0.24, 0.18, "triangle", 0.22); // G5
  tone(1046.5, 0.36, 0.35, "triangle", 0.25); // C6
}

/** Short "drumroll / reveal" sting used when moving from ACTIVE to
 *  SHOWING_RESULTS. Composed of a detuned low buzz then a quick rising
 *  sweep. */
export function sfxReveal(): void {
  if (getMuted()) return;
  const c = getContext();
  if (!c) return;
  // Low buzz (noisy-ish triangle).
  tone(110, 0, 0.12, "sawtooth", 0.12);
  tone(113, 0, 0.12, "sawtooth", 0.08); // slight detune for texture
  // Rising sweep.
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, c.currentTime + 0.13);
  osc.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.4);
  gain.gain.setValueAtTime(0, c.currentTime + 0.13);
  gain.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.17);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + 0.13);
  osc.stop(c.currentTime + 0.45);
}

// ── Background music (file-based, graceful fallback) ─────────────────────

export type MusicTrack = "lobby" | "question" | "victory";

const TRACK_URLS: Record<MusicTrack, string> = {
  lobby: "/audio/quiz/lobby.mp3",
  question: "/audio/quiz/question.mp3",
  victory: "/audio/quiz/victory.mp3",
};

// Shared singleton <audio> so switching tracks doesn't stack them on top.
let musicEl: HTMLAudioElement | null = null;
let currentTrack: MusicTrack | null = null;

function getMusicEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!musicEl) {
    musicEl = new Audio();
    musicEl.loop = true;
    musicEl.volume = 0.5;
    // Quiet failure: if the file isn't there, just stop — no popups.
    musicEl.addEventListener("error", () => {
      /* swallow */
    });
  }
  return musicEl;
}

/** Start (or switch to) a background music track. No-op if already on
 *  the requested track. Respects the mute preference. */
export function playMusic(track: MusicTrack): void {
  const el = getMusicEl();
  if (!el) return;
  if (getMuted()) {
    el.pause();
    return;
  }
  if (currentTrack === track && !el.paused) return;
  currentTrack = track;
  el.src = TRACK_URLS[track];
  el.currentTime = 0;
  // play() returns a Promise that rejects if autoplay is blocked; we
  // swallow it because the user will click something soon and we'll
  // retry on the next state change.
  el.play().catch(() => {});
}

/** Stop any currently-playing background music. */
export function stopMusic(): void {
  const el = getMusicEl();
  if (!el) return;
  el.pause();
  currentTrack = null;
}

/** Apply the current mute preference to the music element. Call after
 *  the user toggles mute. */
export function applyMuteToMusic(): void {
  const el = getMusicEl();
  if (!el) return;
  if (getMuted()) {
    el.pause();
  } else if (currentTrack) {
    el.play().catch(() => {});
  }
}
