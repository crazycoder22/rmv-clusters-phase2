// Answer words — common 5-letter words, one per day (cycles after list ends)
const ANSWER_WORDS = [
  // A
  "about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult", "after", "again",
  "agent", "agree", "ahead", "alarm", "album", "alert", "alike", "alive", "allow", "alone",
  "along", "alter", "among", "angel", "anger", "angle", "angry", "apart", "apple", "apply",
  "arena", "argue", "arise", "array", "aside", "asset", "atlas", "avoid", "award", "aware",
  // B
  "badge", "baker", "bases", "basic", "basis", "batch", "beach", "beard", "beast", "began",
  "begin", "being", "below", "bench", "berry", "birth", "black", "blade", "blame", "blank",
  "blast", "blaze", "bleed", "blend", "bless", "blind", "block", "blood", "bloom", "blown",
  "board", "bonus", "boost", "bound", "boxer", "brain", "brand", "brave", "bread", "break",
  "breed", "brick", "bride", "brief", "bring", "broad", "broke", "brook", "brown", "brush",
  "buddy", "build", "built", "burst", "buyer",
  // C
  "cabin", "cable", "camel", "candy", "cargo", "carry", "catch", "cause", "cedar", "chain",
  "chair", "chalk", "charm", "chart", "chase", "cheap", "check", "cheek", "cheer", "chess",
  "chest", "chief", "child", "china", "chunk", "civic", "civil", "claim", "clash", "class",
  "clean", "clear", "clerk", "click", "cliff", "climb", "cling", "clock", "clone", "close",
  "cloth", "cloud", "coach", "coast", "color", "comet", "comic", "coral", "couch", "could",
  "count", "court", "cover", "crack", "craft", "crane", "crash", "crazy", "cream", "creek",
  "crime", "crisp", "cross", "crowd", "crown", "cruel", "crush", "cubic", "curve", "cycle",
  // D
  "daily", "dance", "death", "debut", "decay", "delay", "delta", "demon", "dense", "depot",
  "depth", "derby", "devil", "diary", "dirty", "dizzy", "dodge", "doubt", "dough", "draft",
  "drain", "drake", "drama", "drank", "drape", "drawn", "dream", "dress", "dried", "drift",
  "drink", "drive", "drops", "drove", "drums", "drunk", "dryer", "dummy", "dusty", "dwarf",
  "dwell", "dying",
  // E
  "eager", "eagle", "early", "earth", "eight", "elbow", "elder", "elect", "elite", "email",
  "ember", "empty", "enemy", "enjoy", "enter", "entry", "equal", "error", "essay", "ethic",
  "event", "every", "exact", "exert", "exile", "exist", "extra",
  // F
  "fable", "facet", "faith", "false", "fancy", "fatal", "fault", "feast", "fence", "fetch",
  "fever", "fiber", "field", "fifty", "fight", "final", "first", "fixed", "flame", "flash",
  "fleet", "flesh", "flick", "flies", "fling", "float", "flood", "floor", "flora", "flour",
  "flown", "fluid", "flush", "flute", "focal", "focus", "force", "forge", "forth", "forty",
  "forum", "found", "frame", "frank", "fraud", "fresh", "front", "froze", "fruit",
  "fully", "funny",
  // G
  "giant", "given", "glass", "globe", "gloom", "glory", "glove", "going", "grace", "grade",
  "grain", "grand", "grant", "grape", "grasp", "grass", "grave", "great", "green", "greet",
  "grief", "grill", "grind", "groan", "groom", "gross", "group", "grove", "grown", "guard",
  "guess", "guest", "guide", "guild", "guilt", "guise",
  // H
  "habit", "happy", "harsh", "hasty", "haunt", "heart", "heavy", "hedge", "herbs", "hiker",
  "hobby", "honey", "honor", "horse", "hotel", "house", "human", "humor", "hurry",
  // I
  "ideal", "image", "imply", "index", "indie", "inner", "input", "irony", "ivory", "issue",
  // J
  "jewel", "joint", "joker", "jolly", "judge", "juice", "jumbo",
  // K
  "karma", "kayak", "knack", "kneel", "knife", "knock", "known",
  // L
  "label", "labor", "laden", "large", "laser", "later", "laugh", "layer", "learn", "lease",
  "least", "leave", "legal", "lemon", "level", "light", "limit", "linen", "liver", "local",
  "lodge", "logic", "loose", "lorry", "lover", "lower", "loyal", "lucky", "lunar", "lunch",
  // M
  "magic", "major", "maker", "mango", "manor", "maple", "march", "marsh", "mason", "match",
  "mayor", "meant", "medal", "media", "mercy", "merge", "merit", "merry", "metal", "meter",
  "micro", "might", "mince", "miner", "minor", "minus", "mirth", "miser", "model", "money",
  "month", "moral", "motor", "motto", "mound", "mount", "mourn", "mouse", "mouth", "movie",
  "muddy", "mural", "music",
  // N
  "naive", "nerve", "never", "niche", "night", "ninja", "noble", "noise", "north", "notch",
  "noted", "novel", "nudge", "nurse",
  // O
  "oasis", "occur", "ocean", "offer", "olive", "onset", "opera", "orbit", "order", "organ",
  "other", "outer", "owned", "owner",
  // P
  "paced", "paint", "panel", "panic", "paper", "party", "pasta", "paste", "patch", "pause",
  "peace", "peach", "pearl", "pedal", "penny", "perch", "phase", "phone", "photo", "piano",
  "piece", "pilot", "pinch", "pitch", "pixel", "pizza", "place", "plaid", "plain", "plane",
  "plank", "plant", "plate", "plaza", "plead", "plumb", "plume", "plump", "plush", "point",
  "poker", "polar", "poppy", "porch", "pouch", "pound", "power", "press", "price", "pride",
  "prime", "print", "prior", "prism", "prize", "probe", "prone", "proof", "prose", "proud",
  "prove", "prune", "pulse", "punch", "pupil", "puppy", "purse",
  // Q
  "qualm", "queen", "query", "quest", "queue", "quick", "quiet", "quill", "quirk", "quota",
  "quote",
  // R
  "radar", "radio", "rainy", "raise", "rally", "ranch", "range", "rapid", "raven", "reach",
  "react", "ready", "realm", "rebel", "reign", "relax", "relay", "renew", "repay", "reply",
  "rider", "ridge", "rifle", "right", "rigid", "rinse", "risky", "rival", "river", "roast",
  "robot", "rocky", "rogue", "rough", "round", "route", "royal", "rugby", "ruins", "ruler",
  "rumor", "rural", "rusty",
  // S
  "sadly", "saint", "salad", "salon", "salsa", "salty", "sandy", "sauce", "sauna", "scale",
  "scare", "scene", "scent", "scope", "score", "scout", "scrap", "seize", "sense", "serve",
  "seven", "shade", "shaft", "shake", "shame", "shape", "share", "shark", "sharp", "shawl",
  "sheen", "sheep", "sheer", "sheet", "shelf", "shell", "shift", "shine", "shiny", "shirt",
  "shock", "shore", "short", "shout", "shove", "shown", "shrub", "siege", "sight", "silly",
  "since", "siren", "sixth", "sixty", "skate", "skill", "skull", "slack", "slang", "slash",
  "slate", "sleep", "sleet", "slice", "slide", "slope", "smart", "smash", "smell", "smile",
  "smith", "smoke", "snack", "snail", "snake", "snare", "sneak", "solar", "solid", "solve",
  "sonic", "sorry", "sound", "south", "space", "spare", "spark", "speak", "spear", "speed",
  "spell", "spend", "spent", "spice", "spill", "spine", "spite", "split", "spoke", "spoon",
  "sport", "spray", "squad", "stack", "staff", "stage", "stain", "stair", "stake", "stale",
  "stalk", "stall", "stamp", "stand", "stare", "stark", "start", "state", "steak", "steal",
  "steam", "steel", "steep", "steer", "stick", "stiff", "still", "sting", "stock", "stole",
  "stone", "stood", "stool", "store", "storm", "story", "stout", "stove", "strap", "straw",
  "strip", "stuck", "stuff", "stump", "stung", "stunt", "style", "sugar", "suite", "sunny",
  "super", "surge", "swamp", "swarm", "swear", "sweat", "sweep", "sweet", "swept", "swift",
  "swing", "swirl", "sword", "swore", "sworn", "swung", "syrup",
  // T
  "table", "tacit", "taint", "taken", "tally", "tango", "taste", "tasty", "teach", "teeth",
  "tempo", "tenet", "tenor", "tense", "terms", "theme", "there", "thick", "thief", "thigh",
  "thing", "think", "third", "thorn", "those", "three", "threw", "throw", "thumb", "tiger",
  "tight", "timer", "title", "toast", "today", "token", "total", "touch", "tough", "towel",
  "tower", "toxic", "trace", "track", "trade", "trail", "train", "trait", "trash", "treat",
  "trend", "trial", "tribe", "trick", "tried", "troop", "trout", "truck", "truly", "trunk",
  "trust", "truth", "tulip", "tutor", "tweak", "tweet", "twice", "twist",
  // U
  "ultra", "under", "unify", "union", "unite", "unity", "until", "upper", "upset", "urban",
  "usage", "usual", "utter",
  // V
  "vague", "valid", "value", "valve", "vault", "venue", "verse", "vigor", "vinyl", "viral",
  "vista", "vital", "vivid", "vocal", "voice", "voter", "vowel",
  // W
  "wagon", "waist", "watch", "water", "weary", "weave", "wedge", "weigh", "weird", "whale",
  "wheat", "wheel", "where", "which", "while", "whine", "whirl", "white", "whole", "widen",
  "wider", "widow", "width", "wield", "windy", "witch", "witty", "woman", "world", "worry",
  "worse", "worst", "worth", "would", "wound", "wrath", "wreck", "wrist", "write", "wrong",
  "wrote",
  // Y-Z
  "yacht", "yield", "young", "youth", "zebra", "zesty",
];

// Epoch date for word cycling (Jan 1, 2025 IST)
const EPOCH = new Date("2025-01-01T00:00:00+05:30");

/** Seeded PRNG (mulberry32) */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle array with a seeded RNG (Fisher-Yates) */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const rng = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Pre-shuffle the word list with a fixed seed so order is random but consistent
const SHUFFLED_WORDS = seededShuffle(ANSWER_WORDS, 20250101);

/** Get today's date string in IST (YYYY-MM-DD) */
export function getTodayIST(): string {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

/** Get today's answer word */
// Manual overrides for specific dates (date → word). Remove entries after they pass.
const WORD_OVERRIDES: Record<string, string> = {};

export function getDailyWord(date?: string): string {
  const target = date ? new Date(date + "T00:00:00+05:30") : new Date();
  const dateStr = date ?? getTodayIST();

  // Check manual override first
  if (WORD_OVERRIDES[dateStr]) return WORD_OVERRIDES[dateStr];

  const daysSinceEpoch = Math.floor(
    (target.getTime() - EPOCH.getTime()) / (1000 * 60 * 60 * 24)
  );
  const index = ((daysSinceEpoch % SHUFFLED_WORDS.length) + SHUFFLED_WORDS.length) % SHUFFLED_WORDS.length;
  return SHUFFLED_WORDS[index];
}

/** Check if a word is a valid 5-letter guess (any 5 alphabetic characters) */
export function isValidGuess(word: string): boolean {
  return word.length === 5 && /^[a-zA-Z]+$/.test(word);
}

export type LetterResult = "correct" | "present" | "absent";

/** Evaluate a guess against the answer, returns feedback per letter */
export function evaluateGuess(guess: string, answer: string): LetterResult[] {
  const g = guess.toLowerCase().split("");
  const a = answer.toLowerCase().split("");
  const result: LetterResult[] = Array(5).fill("absent");

  // Track which answer letters are still available
  const remaining = [...a];

  // First pass: mark correct (green)
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
      remaining[i] = ""; // used up
    }
  }

  // Second pass: mark present (yellow)
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    const idx = remaining.indexOf(g[i]);
    if (idx !== -1) {
      result[i] = "present";
      remaining[idx] = ""; // used up
    }
  }

  return result;
}
