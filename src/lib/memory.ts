// ── Card emoji sets for the memory game ──────────────────────────────────────

const EMOJI_SETS = [
  "🍎", "🍊", "🍋", "🍇", "🍓", "🍒", "🥝", "🍑", "🍍", "🥥",
  "🌸", "🌻", "🌺", "🌷", "🌹", "🎸", "🎺", "🎨", "🎭", "🎪",
  "🦁", "🐘", "🦊", "🐼", "🦋", "🐬", "🦜", "🐙", "🦄", "🐢",
  "🚀", "🌙", "⭐", "🌈", "☀️", "🔥", "💎", "🎯", "🏆", "🎲",
];

// Seeded PRNG (same as wordle/sudoku pattern)
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

export const GRID_CONFIG: Record<Difficulty, { cols: number; rows: number; pairs: number }> = {
  easy: { cols: 4, rows: 3, pairs: 6 },
  medium: { cols: 4, rows: 4, pairs: 8 },
  hard: { cols: 5, rows: 4, pairs: 10 },
};

/** Generate the daily card layout for a given date and difficulty */
export function getDailyCards(date: string, difficulty: Difficulty): string[] {
  const { pairs } = GRID_CONFIG[difficulty];
  const seed = hashString(`memory-${date}-${difficulty}`);
  const rng = mulberry32(seed);

  // Pick random emojis
  const shuffledEmojis = shuffle(EMOJI_SETS, rng);
  const selected = shuffledEmojis.slice(0, pairs);

  // Create pairs and shuffle
  const cards = [...selected, ...selected];
  return shuffle(cards, rng);
}

/**
 * Calculate a score based on moves and time.
 * Score = base points for completing - move penalty - time penalty
 * Base: 1000 (easy), 1500 (medium), 2000 (hard)
 * Move penalty: (moves - optimal) * 20, where optimal = number of pairs
 * Time penalty: 2 points per second
 * Minimum score: 50
 */
export function calculateScore(moves: number, timeSeconds: number, difficulty: string): number {
  const config = GRID_CONFIG[difficulty as Difficulty] ?? GRID_CONFIG.medium;
  const base = difficulty === "easy" ? 1000 : difficulty === "hard" ? 2000 : 1500;
  const optimalMoves = config.pairs;
  const movePenalty = Math.max(0, moves - optimalMoves) * 20;
  const timePenalty = timeSeconds * 2;
  return Math.max(50, base - movePenalty - timePenalty);
}

/** Get today's date in IST */
export function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().split("T")[0];
}
