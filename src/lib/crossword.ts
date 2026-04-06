import { wordsByLength, clueByWord } from "./crossword-words";

// ── IST helpers (same as sudoku.ts) ──────────────────────────────────────

export function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Seeded PRNG (same as sudoku.ts) ──────────────────────────────────────

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

// ── Grid templates ───────────────────────────────────────────────────────
// 5×5 grids. true = white, false = black.
// Designed so every white cell is in ≥1 run of length 3–5.
// Mix of 3/4/5-letter slots keeps backtracking fast.

type Template = boolean[][];

const T = true, F = false;

// Templates with 3-5 black cells creating a good mix of 3/4-letter slots.
// Fewer 5-letter slots = much faster backtracking.
const TEMPLATES: Template[] = [
  // 0: Cross pattern – mostly 3-letter words
  [[F,T,T,T,F],[T,T,T,T,T],[T,T,T,T,T],[T,T,T,T,T],[F,T,T,T,F]],
  // 1: Diamond corners
  [[F,T,T,T,T],[T,T,T,T,F],[T,T,T,T,T],[F,T,T,T,T],[T,T,T,T,F]],
  // 2: Checkerboard corners
  [[T,T,T,T,F],[T,T,T,T,T],[T,T,T,T,T],[T,T,T,T,T],[F,T,T,T,T]],
  // 3: Center + corner
  [[F,T,T,T,T],[T,T,T,T,T],[T,T,F,T,T],[T,T,T,T,T],[T,T,T,T,F]],
  // 4: Center + corner flipped
  [[T,T,T,T,F],[T,T,T,T,T],[T,T,F,T,T],[T,T,T,T,T],[F,T,T,T,T]],
  // 5: Offset 2+2
  [[F,F,T,T,T],[T,T,T,T,T],[T,T,T,T,T],[T,T,T,T,T],[T,T,T,F,F]],
  // 6: Offset 2+2 flipped
  [[T,T,T,F,F],[T,T,T,T,T],[T,T,T,T,T],[T,T,T,T,T],[F,F,T,T,T]],
  // 7: Side + center
  [[T,T,T,T,T],[F,T,T,T,T],[T,T,F,T,T],[T,T,T,T,F],[T,T,T,T,T]],
  // 8: Four corners
  [[F,T,T,T,F],[T,T,T,T,T],[T,T,T,T,T],[T,T,T,T,T],[F,T,T,T,F]],
  // 9: Diagonal 3
  [[F,T,T,T,T],[T,T,T,T,T],[T,T,F,T,T],[T,T,T,T,T],[T,T,T,T,F]],
];

// ── Slot extraction ──────────────────────────────────────────────────────

interface Slot {
  id: number;
  direction: "across" | "down";
  row: number;
  col: number;
  length: number;
  cells: [number, number][];
}

function extractSlots(template: Template): {
  slots: Slot[];
  cellNumbers: number[][];
  allCovered: boolean;
} {
  const cellNumbers: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  const slots: Slot[] = [];
  let clueNum = 0;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!template[r][c]) continue;

      const startsAcross =
        (c === 0 || !template[r][c - 1]) && c + 1 < 5 && template[r][c + 1];
      const startsDown =
        (r === 0 || !template[r - 1][c]) && r + 1 < 5 && template[r + 1][c];

      if (startsAcross || startsDown) {
        clueNum++;
        cellNumbers[r][c] = clueNum;

        if (startsAcross) {
          const cells: [number, number][] = [];
          for (let cc = c; cc < 5 && template[r][cc]; cc++) cells.push([r, cc]);
          if (cells.length >= 3) {
            slots.push({ id: clueNum, direction: "across", row: r, col: c, length: cells.length, cells });
          }
        }
        if (startsDown) {
          const cells: [number, number][] = [];
          for (let rr = r; rr < 5 && template[rr][c]; rr++) cells.push([rr, c]);
          if (cells.length >= 3) {
            slots.push({ id: clueNum, direction: "down", row: r, col: c, length: cells.length, cells });
          }
        }
      }
    }
  }

  // Check every white cell is in at least one slot
  const covered = new Set<string>();
  for (const slot of slots) {
    for (const [r, c] of slot.cells) covered.add(`${r},${c}`);
  }
  let allCovered = true;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (template[r][c] && !covered.has(`${r},${c}`)) allCovered = false;
    }
  }

  return { slots, cellNumbers, allCovered };
}

// ── Intersection map ─────────────────────────────────────────────────────

function buildIntersections(slots: Slot[]) {
  const cellToSlot: Map<string, { slotIdx: number; pos: number }[]> = new Map();
  for (let si = 0; si < slots.length; si++) {
    for (let pi = 0; pi < slots[si].cells.length; pi++) {
      const key = `${slots[si].cells[pi][0]},${slots[si].cells[pi][1]}`;
      if (!cellToSlot.has(key)) cellToSlot.set(key, []);
      cellToSlot.get(key)!.push({ slotIdx: si, pos: pi });
    }
  }

  const intersections: { slotA: number; posA: number; slotB: number; posB: number }[] = [];
  for (const entries of cellToSlot.values()) {
    if (entries.length === 2) {
      intersections.push({
        slotA: entries[0].slotIdx, posA: entries[0].pos,
        slotB: entries[1].slotIdx, posB: entries[1].pos,
      });
    }
  }
  return intersections;
}

// ── Backtracking fill with forward-checking (constraint propagation) ─────

function fillGrid(
  slots: Slot[],
  intersections: ReturnType<typeof buildIntersections>,
  rng: () => number,
): string[] | null {
  const n = slots.length;

  // Per-slot intersection lookup
  const slotIx: { other: number; myPos: number; otherPos: number }[][] = Array.from({ length: n }, () => []);
  for (const ix of intersections) {
    slotIx[ix.slotA].push({ other: ix.slotB, myPos: ix.posA, otherPos: ix.posB });
    slotIx[ix.slotB].push({ other: ix.slotA, myPos: ix.posB, otherPos: ix.posA });
  }

  // Initial candidate lists per slot (shuffled)
  const initialDomains: string[][] = slots.map((slot) => {
    const words = wordsByLength.get(slot.length) || [];
    return shuffle(words.map((w) => w.word), rng);
  });

  // Current domains (will be pruned during search)
  const domains: string[][] = initialDomains.map((d) => [...d]);
  const placed: (string | null)[] = new Array(n).fill(null);
  const usedWords = new Set<string>();

  // Sort by most constrained first (MRV heuristic: smallest domain first)
  function pickNext(remaining: number[]): number {
    let best = remaining[0];
    let bestSize = domains[best].length;
    for (let i = 1; i < remaining.length; i++) {
      if (domains[remaining[i]].length < bestSize) {
        best = remaining[i];
        bestSize = domains[best].length;
      }
    }
    return best;
  }

  // Forward check: filter domains of unplaced neighbors
  function forwardCheck(si: number, word: string, remaining: Set<number>): Map<number, string[]> | null {
    const saved = new Map<number, string[]>(); // save old domains to restore
    for (const { other, myPos, otherPos } of slotIx[si]) {
      if (!remaining.has(other)) continue; // already placed
      const requiredChar = word[myPos];
      const oldDomain = domains[other];
      saved.set(other, oldDomain);
      const newDomain = oldDomain.filter((w) => w[otherPos] === requiredChar && !usedWords.has(w));
      if (newDomain.length === 0) {
        // Restore all saved domains
        for (const [s, d] of saved) domains[s] = d;
        return null; // dead end
      }
      domains[other] = newDomain;
    }
    return saved;
  }

  function backtrack(remaining: number[]): boolean {
    if (remaining.length === 0) return true;

    const remainingSet = new Set(remaining);
    const si = pickNext(remaining);
    const nextRemaining = remaining.filter((s) => s !== si);

    for (const word of domains[si]) {
      if (usedWords.has(word)) continue;

      // Check already-placed intersections
      let ok = true;
      for (const { other, myPos, otherPos } of slotIx[si]) {
        if (placed[other] !== null && placed[other]![otherPos] !== word[myPos]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      // Forward check: prune neighbor domains
      const saved = forwardCheck(si, word, remainingSet);
      if (!saved) continue; // dead end detected early

      placed[si] = word;
      usedWords.add(word);

      if (backtrack(nextRemaining)) return true;

      // Restore
      placed[si] = null;
      usedWords.delete(word);
      for (const [s, d] of saved) domains[s] = d;
    }
    return false;
  }

  const allSlots = slots.map((_, i) => i);
  return backtrack(allSlots) ? (placed as string[]) : null;
}

// ── Public types ─────────────────────────────────────────────────────────

export interface CrosswordClue {
  number: number;
  direction: "across" | "down";
  clue: string;
  answer: string;
  cells: [number, number][];
}

export interface CrosswordPuzzle {
  grid: string[][];
  solution: string[][];
  clues: CrosswordClue[];
  cellNumbers: number[][];
}

// ── Daily puzzle generation ──────────────────────────────────────────────

export function generateDailyPuzzle(date: string): CrosswordPuzzle {
  const seed = hashString("crossword-" + date);
  const rng = mulberry32(seed);

  const templateOrder = shuffle(TEMPLATES.map((_, i) => i), rng);

  for (const ti of templateOrder) {
    const template = TEMPLATES[ti];
    const { slots, cellNumbers, allCovered } = extractSlots(template);
    if (slots.length < 3 || !allCovered) continue;

    const fillRng = mulberry32(seed + ti * 7919);
    const words = fillGrid(slots, buildIntersections(slots), fillRng);
    if (!words) continue;

    // Build solution grid
    const solution: string[][] = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => (template[r][c] ? "" : "."))
    );
    for (let si = 0; si < slots.length; si++) {
      const word = words[si];
      for (let pi = 0; pi < slots[si].cells.length; pi++) {
        const [r, c] = slots[si].cells[pi];
        solution[r][c] = word[pi];
      }
    }

    // Verify no empty white cells
    let valid = true;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (template[r][c] && solution[r][c] === "") valid = false;
      }
    }
    if (!valid) continue;

    const grid: string[][] = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => (template[r][c] ? "" : "."))
    );

    const clues: CrosswordClue[] = slots.map((slot, si) => ({
      number: slot.id,
      direction: slot.direction,
      clue: clueByWord.get(words[si]) || "???",
      answer: words[si],
      cells: slot.cells,
    }));

    clues.sort((a, b) => {
      if (a.direction !== b.direction) return a.direction === "across" ? -1 : 1;
      return a.number - b.number;
    });

    return { grid, solution, clues, cellNumbers };
  }

  throw new Error(`Failed to generate crossword for date ${date}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function isPuzzleComplete(playerGrid: string[][], solution: string[][]): boolean {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (solution[r][c] === ".") continue;
      if (playerGrid[r][c]?.toUpperCase() !== solution[r][c]) return false;
    }
  }
  return true;
}
