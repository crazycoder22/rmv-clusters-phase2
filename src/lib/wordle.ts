// Answer words — common 5-letter words, one per day (cycles after list ends)
const ANSWER_WORDS = [
  "about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult", "after", "again",
  "agent", "agree", "ahead", "alarm", "album", "alert", "alike", "alive", "allow", "alone",
  "along", "alter", "among", "angel", "anger", "angle", "angry", "apart", "apple", "apply",
  "arena", "argue", "arise", "array", "aside", "asset", "avoid", "award", "aware", "badly",
  "baker", "bases", "basic", "basis", "beach", "began", "begin", "being", "below", "bench",
  "berry", "birth", "black", "blade", "blame", "blank", "blast", "blaze", "bleed", "blend",
  "bless", "blind", "block", "blood", "bloom", "blown", "board", "boost", "bound", "brain",
  "brand", "brave", "bread", "break", "breed", "brick", "bride", "brief", "bring", "broad",
  "broke", "brook", "brown", "brush", "buddy", "build", "built", "burst", "buyer", "cabin",
  "cable", "camel", "candy", "cargo", "carry", "catch", "cause", "cedar", "chain", "chair",
  "charm", "chart", "chase", "cheap", "check", "cheek", "cheer", "chess", "chest", "chief",
  "child", "china", "chunk", "civic", "civil", "claim", "clash", "class", "clean", "clear",
  "clerk", "click", "cliff", "climb", "cling", "clock", "clone", "close", "cloth", "cloud",
  "coach", "coast", "color", "comet", "comic", "coral", "could", "count", "court", "cover",
  "crack", "craft", "crane", "crash", "crazy", "cream", "creek", "crime", "crisp", "cross",
  "crowd", "crown", "cruel", "crush", "cubic", "curve", "cycle", "daily", "dance", "death",
  "debut", "decay", "delay", "delta", "dense", "depot", "depth", "derby", "devil", "diary",
  "dirty", "dizzy", "dodge", "doubt", "dough", "draft", "drain", "drake", "drama", "drank",
  "drape", "drawn", "dream", "dress", "dried", "drift", "drink", "drive", "drops", "drove",
  "drums", "drunk", "dryer", "dummy", "dusty", "dwarf", "dwell", "dying", "eager", "eagle",
  "early", "earth", "eight", "elect", "elite", "email", "empty", "enemy", "enjoy", "enter",
  "entry", "equal", "error", "essay", "ethic", "event", "every", "exact", "exert", "exile",
  "exist", "extra", "fable", "facet", "faith", "false", "fancy", "fatal", "fault", "feast",
  "fence", "fetch", "fever", "fiber", "field", "fifty", "fight", "final", "first", "fixed",
  "flame", "flash", "fleet", "flesh", "flick", "flies", "fling", "float", "flood", "floor",
  "flora", "flour", "flown", "fluid", "flush", "flute", "focal", "focus", "force", "forge",
  "forth", "forum", "found", "frame", "frank", "fraud", "fresh", "front", "froze", "fruit",
  "fully", "funny", "giant", "given", "glass", "globe", "gloom", "glory", "glove", "going",
  "grace", "grade", "grain", "grand", "grant", "grape", "grasp", "grass", "grave", "great",
  "green", "greet", "grief", "grill", "grind", "groan", "groom", "gross", "group", "grove",
  "grown", "guard", "guess", "guest", "guide", "guild", "guilt", "guise", "habit", "happy",
  "harsh", "hasty", "haunt", "heart", "heavy", "hedge", "reign", "herbs", "hiker", "hobby",
  "honor", "horse", "hotel", "house", "human", "humor", "hurry", "ideal", "image", "imply",
  "index", "indie", "inner", "input", "irony", "ivory", "jewel", "joint", "joker", "jolly",
  "judge", "juice", "jumbo", "karma", "kayak", "knack", "kneel", "knife", "knock", "known",
  "label", "labor", "laden", "large", "laser", "later", "laugh", "layer", "learn", "lease",
  "least", "leave", "legal", "lemon", "level", "light", "limit",
];

// Epoch date for word cycling (Jan 1, 2025 IST)
const EPOCH = new Date("2025-01-01T00:00:00+05:30");

/** Get today's date string in IST (YYYY-MM-DD) */
export function getTodayIST(): string {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

/** Get today's answer word */
export function getDailyWord(date?: string): string {
  const target = date ? new Date(date + "T00:00:00+05:30") : new Date();
  const daysSinceEpoch = Math.floor(
    (target.getTime() - EPOCH.getTime()) / (1000 * 60 * 60 * 24)
  );
  const index = ((daysSinceEpoch % ANSWER_WORDS.length) + ANSWER_WORDS.length) % ANSWER_WORDS.length;
  return ANSWER_WORDS[index];
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
