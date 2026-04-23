// Deterministic daily card layout + scoring for the Memory Match game.
// Mirrors `../../../src/lib/memory.ts` in the web app so a given IST date
// produces the same card arrangement on web and mobile.

const EMOJI_SETS = [
  "🍎", "🍊", "🍋", "🍇", "🍓", "🍒", "🥝", "🍑", "🍍", "🥥",
  "🌸", "🌻", "🌺", "🌷", "🌹", "🎸", "🎺", "🎨", "🎭", "🎪",
  "🦁", "🐘", "🦊", "🐼", "🦋", "🐬", "🦜", "🐙", "🦄", "🐢",
  "🚀", "🌙", "⭐", "🌈", "☀️", "🔥", "💎", "🎯", "🏆", "🎲",
];

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Difficulty = "easy" | "medium" | "hard";

export const GRID_CONFIG: Record<
  Difficulty,
  { cols: number; rows: number; pairs: number }
> = {
  easy: { cols: 4, rows: 3, pairs: 6 },
  medium: { cols: 4, rows: 4, pairs: 8 },
  hard: { cols: 5, rows: 4, pairs: 10 },
};

export const ACTIVE_DIFFICULTY: Difficulty = "hard";

export function getDailyCards(date: string, difficulty: Difficulty): string[] {
  const { pairs } = GRID_CONFIG[difficulty];
  const seed = hashString(`memory-${date}-${difficulty}`);
  const rng = mulberry32(seed);
  const selected = shuffle(EMOJI_SETS, rng).slice(0, pairs);
  return shuffle([...selected, ...selected], rng);
}

export function calculateScore(
  moves: number,
  timeSeconds: number,
  difficulty: Difficulty
): number {
  const { pairs } = GRID_CONFIG[difficulty];
  const base =
    difficulty === "easy" ? 1000 : difficulty === "hard" ? 2000 : 1500;
  const movePenalty = Math.max(0, moves - pairs) * 20;
  const timePenalty = timeSeconds * 2;
  return Math.max(50, base - movePenalty - timePenalty);
}

export function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(
    now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000
  );
  return ist.toISOString().split("T")[0];
}

const STAR_THRESHOLDS: Record<Difficulty, [number, number]> = {
  easy: [10, 16],
  medium: [14, 22],
  hard: [18, 28],
};

export function getStars(difficulty: Difficulty, moves: number): number {
  const [three, two] = STAR_THRESHOLDS[difficulty];
  if (moves <= three) return 3;
  if (moves <= two) return 2;
  return 1;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
