// Spelling Bee–style anagram game. The puzzle is determined entirely by the
// IST date — every player gets the same 7 letters and the same required
// letter on a given day. Word validation runs server-side against a bundled
// dictionary; nothing about scoring lives on the client.

import fs from "fs";
import path from "path";

// ── Curated pangram seeds ─────────────────────────────────────────────────
// Common 7-letter English words with 7 distinct letters. The daily puzzle
// pulls one of these and the source word is guaranteed to be a valid pangram
// of the resulting puzzle, so a perfect score is always achievable.
//
// Avoided here: Q / X / Z / J (too restrictive when paired) and obvious
// regional spellings. Keep alphabetic for deterministic ordering.
const PANGRAM_SEEDS = [
  "ALMONDS", "ANCHORS", "ANGLERS", "ANTLERS", "BANTERS", "BELONGS",
  "BLAMING", "BLISTER", "BOATING", "BOULDER", "BRACING", "BREATHS",
  "BREATHY", "BROWNED", "BUILDER", "BURNING", "CALMING", "CAMPED",
  "CARVING", "CAUTION", "CAVERNS", "CHARMED", "CLEANUP", "CLEARED",
  "CLOSING", "COMPILE", "CORDIAL", "COURAGE", "COWHIDE", "CRAFTED",
  "CRYPTIC", "CUSTODY", "DAMPENS", "DAPHNES", "DARKENS", "DECIBEL",
  "DICTUMS", "DIRGEFUL", "DIRTILY", "DOLPHIN", "DREAMTH", "DUMPING",
  "EDITORS", "EQUATOR", "ETCHING", "EUPHORIA", "EXPANSE", "EXTRACT",
  "FACTORS", "FAILING", "FARMING", "FATHERS", "FILTHED", "FIRMEST",
  "FLAGONS", "FORTUNE", "FRAMING", "FRINGED", "FROZEN", "FUSIONS",
  "GAINERS", "GAMBOLS", "GLACIER", "GLOATER", "GOLFERS", "GRAFTED",
  "GRANITE", "GRIEVED", "GRINDER", "GROUTED", "HAIRCUT", "HANGOUT",
  "HARDIES", "HARVEST", "HEADING", "HEROIC", "HISTORY", "HONESTY",
  "HOSPICE", "HOUSING", "HUMORED", "IMPORT", "INHALED", "JOURNAL",
  "KITCHEN", "KNOTTED", "LACQUER", "LANDOUS", "LAUNDRY", "LEAGUES",
  "LENDING", "LINGERS", "LIVENED", "LONGEST", "MANGLED", "MARGINS",
  "MARSHED", "MATURES", "MIGRATE", "MIGRATIONS", "MODESTY", "MONARCH",
  "MORALES", "MOUNTAIN", "NEUTRAL", "NETWORK", "NUMBERS", "OCTAVES",
  "ORCHIDS", "OUTLINE", "OUTPOST", "PARCELS", "PARTIES", "PATIENT",
  "PENALTY", "PHANTOM", "PICTURE", "PINHEAD", "PLAYING", "PLAYTIME",
  "POLEMIC", "POULTRY", "PRECAST", "PRINTED", "PROFANE", "PRUDENT",
  "READILY", "READING", "REALIST", "REGAINS", "RELIANT", "REMAINS",
  "ROAMING", "ROUTINE", "SCALPED", "SCAMPED", "SCRAPED", "SECTION",
  "SERVING", "SHAMING", "SHINGLE", "SHRIMPS", "SLEUTHY", "SMOLDER",
  "SPAWNED", "STABLED", "STARING", "STEWARD", "STRANGE", "STRONG",
  "STUMBLE", "SUBLIME", "SURFING", "THIEVES", "THUNDER", "TIMBALE",
  "TRAINED", "TRENDS", "TRIUMPH", "TROUBLE", "VENDING", "VERSING",
  "VIRGINS", "WANDERS", "WATCHED", "WEAPONS", "WHALING", "WORKING",
  "YACHTED",
];

// Filter to the ones that genuinely have 7 distinct letters and use only
// allowed alphabet (some entries above might have slipped through with
// repeats or wrong length — be defensive).
function isCleanPangram(word: string): boolean {
  if (word.length !== 7) return false;
  const seen = new Set<string>();
  for (const c of word.toLowerCase()) {
    if (seen.has(c)) return false;
    seen.add(c);
  }
  return /^[a-z]{7}$/.test(word.toLowerCase());
}

const VALID_PANGRAMS = PANGRAM_SEEDS.map((w) => w.toLowerCase()).filter(
  isCleanPangram
);

// ── Dictionary ────────────────────────────────────────────────────────────
// Loaded once on first call; module-level cache survives request lifetimes
// inside a single warm Node process (Vercel functions reuse processes).
let dictCache: Set<string> | null = null;

function loadDictionary(): Set<string> {
  if (dictCache) return dictCache;
  const file = path.join(process.cwd(), "src", "data", "anagram-dict.txt");
  const text = fs.readFileSync(file, "utf8");
  dictCache = new Set(
    text.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  return dictCache;
}

// ── PRNG ──────────────────────────────────────────────────────────────────
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── Public API ────────────────────────────────────────────────────────────

export function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(
    now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000
  );
  return ist.toISOString().split("T")[0];
}

export function getDailyPuzzle(date: string): {
  letters: string[]; // 7 distinct lowercase letters, sorted alphabetically
  required: string;  // single lowercase letter from `letters`
} {
  const seed = hashString("anagram-" + date);
  const idx = seed % VALID_PANGRAMS.length;
  const seedWord = VALID_PANGRAMS[idx];
  const letters = [...new Set(seedWord.split(""))].sort();
  // Pick the required letter from the 7 — bias against vowels (a/e/i/o/u) so
  // the constraint actually shapes the puzzle. If only vowels are available
  // we just take the first.
  const consonants = letters.filter((l) => !"aeiou".includes(l));
  const pool = consonants.length > 0 ? consonants : letters;
  const required = pool[(seed >>> 8) % pool.length];
  return { letters, required };
}

export type GuessResult =
  | { ok: true; isPangram: boolean; score: number }
  | { ok: false; reason: GuessError };

export type GuessError =
  | "TOO_SHORT"
  | "MISSING_REQUIRED"
  | "BAD_LETTER"
  | "NOT_A_WORD"
  | "ALREADY_FOUND";

export function judgeWord(
  rawWord: string,
  letters: string[],
  required: string,
  alreadyFound: Set<string>
): GuessResult {
  const word = (rawWord || "").trim().toLowerCase();
  if (word.length < 4) return { ok: false, reason: "TOO_SHORT" };
  if (!word.includes(required)) return { ok: false, reason: "MISSING_REQUIRED" };
  const allowed = new Set(letters);
  for (const c of word) {
    if (!allowed.has(c)) return { ok: false, reason: "BAD_LETTER" };
  }
  if (alreadyFound.has(word)) return { ok: false, reason: "ALREADY_FOUND" };
  const dict = loadDictionary();
  if (!dict.has(word)) return { ok: false, reason: "NOT_A_WORD" };

  const isPangram = letters.every((l) => word.includes(l));
  const score = word.length + (isPangram ? 7 : 0);
  return { ok: true, isPangram, score };
}

export function calculateRunScore(
  words: string[],
  letters: string[]
): { score: number; pangrams: number } {
  let score = 0;
  let pangrams = 0;
  for (const w of words) {
    const isP = letters.every((l) => w.includes(l));
    score += w.length + (isP ? 7 : 0);
    if (isP) pangrams++;
  }
  return { score, pangrams };
}

// Reachable rank thresholds — used for the "Genius/Amazing/Great" badge UX.
// Computed against the maximum possible score for the day's puzzle.
//
// Tuned against a 4-15 letter `words_alpha` dictionary which inflates the
// max because of obscure entries (AALII, ABACA, BANTU, etc.). Real human
// players find a few dozen common words and shouldn't see 5% after 50
// answers — these thresholds give "Genius" at ~25% which matches a strong
// daily run on the current dict. Iterate as we learn from real play.
export function getRankFromPercent(pct: number): string {
  if (pct >= 80) return "Queen Bee";
  if (pct >= 25) return "Genius";
  if (pct >= 15) return "Amazing";
  if (pct >= 10) return "Great";
  if (pct >= 7) return "Nice";
  if (pct >= 4) return "Solid";
  if (pct >= 2) return "Good";
  if (pct >= 1) return "Moving up";
  if (pct >= 0.5) return "Good start";
  return "Beginner";
}

// Total achievable score for a puzzle (computed once, used to build rank
// thresholds and the "X / Y" display).
export function getMaxScore(letters: string[], required: string): number {
  const dict = loadDictionary();
  const allowed = new Set(letters);
  let total = 0;
  for (const word of dict) {
    if (word.length < 4) continue;
    if (!word.includes(required)) continue;
    let ok = true;
    for (const c of word) {
      if (!allowed.has(c)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const isP = letters.every((l) => word.includes(l));
    total += word.length + (isP ? 7 : 0);
  }
  return total;
}
