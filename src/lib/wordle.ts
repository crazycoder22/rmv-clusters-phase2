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
  "crack", "craft", "crane", "crash", "crazy", "cream", "creek", "crew", "crime", "crisp",
  "cross", "crowd", "crown", "cruel", "crush", "cubic", "curve", "cycle", "daily", "dance",
  "death", "debut", "decay", "delay", "delta", "dense", "depot", "depth", "derby", "devil",
  "diary", "dirty", "dizzy", "dodge", "doubt", "dough", "draft", "drain", "drake", "drama",
  "drank", "drape", "drawn", "dream", "dress", "dried", "drift", "drink", "drive", "droit",
  "drops", "drove", "drugs", "drums", "drunk", "dryer", "dummy", "dusty", "dwarf", "dwell",
  "dying", "eager", "eagle", "early", "earth", "eight", "elect", "elite", "email", "empty",
  "enemy", "enjoy", "enter", "entry", "equal", "error", "essay", "ethic", "event", "every",
  "exact", "exert", "exile", "exist", "extra", "fable", "facet", "faith", "false", "fancy",
  "fatal", "fault", "feast", "fence", "fetch", "fever", "fiber", "field", "fifty", "fight",
  "final", "first", "fixed", "flame", "flash", "fleet", "flesh", "flick", "flies", "fling",
  "float", "flood", "floor", "flora", "flour", "flown", "fluid", "flush", "flute", "focal",
  "focus", "force", "forge", "forth", "forum", "found", "frame", "frank", "fraud", "fresh",
  "front", "froze", "fruit", "fully", "funny", "giant", "given", "glass", "globe", "gloom",
  "glory", "glove", "going", "grace", "grade", "grain", "grand", "grant", "grape", "grasp",
  "grass", "grave", "great", "green", "greet", "grief", "grill", "grind", "groan", "groom",
  "gross", "group", "grove", "grown", "guard", "guess", "guest", "guide", "guild", "guilt",
  "guise", "habit", "happy", "harsh", "hasty", "haunt", "heart", "heavy", "hedge", "reign",
  "herbs", "hiker", "hobby", "honor", "horse", "hotel", "house", "human", "humor", "hurry",
  "ideal", "image", "imply", "index", "indie", "inner", "input", "irony", "ivory", "jewel",
  "joint", "joker", "jolly", "judge", "juice", "jumbo", "karma", "kayak", "knack", "kneel",
  "knife", "knock", "known", "label", "labor", "laden", "large", "laser", "later", "laugh",
  "layer", "learn", "lease", "least", "leave", "legal", "lemon", "level", "light", "limit",
];

// Valid 5-letter words for guess validation (includes answer words + more)
const VALID_WORDS = new Set([
  ...ANSWER_WORDS,
  "aahed", "aalii", "abaci", "aback", "abase", "abash", "abate", "abbey", "abbot", "abhor",
  "abide", "abler", "abode", "abort", "abyss", "acorn", "acres", "acted", "adage", "added",
  "adder", "adept", "adieu", "admin", "adobe", "aegis", "afire", "afoul", "ailed", "aimed",
  "aired", "aisle", "alder", "algae", "alien", "align", "allay", "alley", "allot", "alloy",
  "aloft", "alpha", "altar", "amber", "amble", "amend", "ample", "amuse", "ankle", "annex",
  "antic", "anvil", "aorta", "aping", "areal", "armed", "armor", "aroma", "arose", "ascii",
  "ashen", "aster", "atlas", "atone", "attic", "audio", "audit", "augur", "aunts", "avian",
  "avid", "awake", "awash", "awful", "awoke", "axial", "axiom", "azure", "badge", "bagel",
  "baggy", "baked", "balls", "balmy", "bands", "banks", "baron", "basal", "batch", "baton",
  "beady", "beard", "beast", "beech", "befit", "begun", "beige", "belle", "belly", "berth",
  "beset", "betty", "bible", "biddy", "bigot", "bilge", "bingo", "biome", "birch", "birds",
  "bison", "bitty", "blare", "bleat", "blimp", "bliss", "blitz", "bloat", "blogs", "bloke",
  "blond", "bloss", "blots", "blown", "bluff", "blunt", "blurt", "blush", "boats", "bogus",
  "bolts", "bonds", "boned", "bones", "bonus", "books", "boots", "borax", "bored", "borne",
  "boron", "bossy", "botch", "bough", "bowed", "bowel", "boxer", "brace", "braid", "brake",
  "brash", "brass", "brawn", "braze", "brief", "brine", "brink", "brisk", "broil", "brood",
  "brook", "broth", "brunt", "brush", "brute", "budge", "buggy", "bulge", "bulky", "bully",
  "bunch", "bunny", "burnt", "cache", "cadet", "cairn", "caulk", "cease", "cents", "chafe",
  "chaff", "champ", "chant", "chaos", "chaps", "chard", "chasm", "chewy", "chick", "chili",
  "chime", "chirp", "choir", "chord", "chore", "chose", "chump", "churn", "cider", "cigar",
  "cinch", "cites", "cited", "clack", "clamp", "clang", "clank", "claps", "clasp", "claw",
  "clay", "clerk", "climb", "clink", "clips", "cloak", "cloth", "clout", "clubs", "cluck",
  "clued", "clump", "clung", "coals", "coats", "cobra", "cocoa", "coins", "colic", "colon",
  "comma", "conch", "condo", "cones", "copse", "corgi", "corks", "corps", "couch", "cough",
  "could", "coupe", "coups", "coves", "covet", "coward", "coyly", "crabs", "cram", "crave",
  "crawl", "craze", "creed", "creep", "crest", "crews", "crimp", "crops", "crude", "cruet",
  "crumb", "crypt", "curly", "curry", "curse", "cyber", "cynic", "daddy", "dainty", "dairy",
  "daisy", "dally", "darts", "dated", "datum", "deals", "dealt", "deary", "decal", "decks",
  "decor", "decoy", "decry", "deeds", "demon", "denim", "deter", "detox", "deuce", "diets",
  "digit", "dimly", "diner", "disco", "ditch", "ditto", "dodge", "doing", "donor", "doom",
  "dorky", "doses", "dotes", "dotty", "dowdy", "downs", "doyen", "dozed", "dozen", "drags",
  "drawl", "drawn", "dread", "drill", "drool", "drone", "drops", "drown", "drugs", "druid",
  "dryly", "ducts", "dudes", "dully", "dumps", "dunce", "duped", "duple", "dusky", "dutch",
  "duvet", "eager", "easel", "eaten", "eater", "eaves", "ebbed", "ebony", "edged", "edges",
  "edict", "edify", "eerie", "eight", "elbow", "elder", "elfin", "elide", "elope", "elude",
  "ember", "emcee", "emote", "ended", "endow", "enema", "ensue", "envoy", "epoch", "equip",
  "erode", "erupt", "ether", "evade", "evict", "evoke", "ewing", "exalt", "excel", "exude",
  "eying", "faded", "fairy", "faker", "falls", "farce", "fauna", "feats", "feeds", "feign",
  "feint", "felon", "femur", "ferry", "fetid", "feud", "fibre", "filch", "filed", "filet",
  "filmy", "filth", "finch", "finds", "finer", "fired", "firms", "fjord", "flack", "flags",
  "flair", "flake", "flaky", "flank", "flaps", "flare", "flask", "flats", "flaxy", "fleas",
  "flesh", "flier", "fling", "flint", "flips", "flirt", "flock", "flogs", "flood", "flops",
  "floss", "flour", "flows", "flubs", "fluff", "flush", "foamy", "focal", "foggy", "foils",
  "folks", "folly", "fonts", "foray", "forge", "forgo", "forms", "forte", "forty", "forum",
  "fossil", "fouls", "foxes", "foyer", "frail", "frame", "frays", "freed", "freer", "frets",
  "friar", "fried", "frill", "frisk", "fritz", "frizz", "frogs", "frond", "frost", "froth",
  "froze", "frugal", "fuels", "fugal", "fully", "fumes", "funds", "fungi", "funky", "funny",
  "furry", "fused", "fuses", "fussy", "fuzzy", "gaffe", "gaily", "gains", "gamer", "games",
  "gamma", "gangs", "gassy", "gates", "gauge", "gaunt", "gauze", "gazed", "gazer", "gears",
  "geese", "genes", "genre", "genus", "germs", "getup", "ghoul", "giddy", "gifts", "gills",
  "girly", "girth", "giver", "gives", "gland", "glare", "gleam", "glean", "glide", "glint",
  "gloat", "gloss", "goals", "goats", "godly", "going", "golly", "goose", "gorge", "gotta",
  "gouge", "gourd", "gowns", "grabs", "grace", "grade", "graft", "grain", "grams", "grave",
  "gravy", "graze", "great", "greed", "greek", "greet", "grids", "grief", "grime", "grimy",
  "gripe", "grips", "grist", "grits", "groin", "groom", "grope", "grove", "growl", "grown",
  "gruel", "gruff", "grump", "grunt", "guide", "guile", "guilt", "gulch", "gulls", "gully",
  "gumbo", "gummy", "gusto", "gusty", "gypsy", "haiku", "hairs", "halve", "hands", "handy",
  "hangs", "hardy", "haste", "hatch", "hated", "haven", "havoc", "hazel", "heads", "heady",
  "heard", "heave", "hefty", "heist", "helix", "hello", "hence", "henna", "herbs", "herds",
  "heron", "hills", "hilly", "hinge", "hippo", "hitch", "hoard", "hobby", "hoist", "holly",
  "homer", "homes", "honey", "honor", "hoped", "horns", "horny", "hound", "hover", "howdy",
  "hulks", "human", "humid", "humps", "humus", "hunks", "hunts", "hurts", "husky", "hydra",
  "hyena", "hyper", "icing", "idiom", "idiot", "idled", "idyll", "igloo", "image", "imbue",
  "impel", "inane", "incur", "inept", "inert", "infer", "infix", "ingot", "inlet", "input",
  "inter", "intro", "ionic", "irate", "irked", "issue", "ivory", "jabot", "jacks", "jaded",
  "jails", "jambs", "jaunt", "jazzy", "jeans", "jelly", "jenny", "jerks", "jerky", "jesus",
  "jiffy", "jig", "jimmy", "jived", "jockey", "joins", "joust", "jowls", "juice", "jumps",
  "junco", "junky", "juror", "jutty", "kayak", "keels", "keeps", "kefir", "kelps", "kicks",
  "kills", "kinds", "kings", "kiosk", "kites", "knave", "knead", "kneed", "knelt", "knobs",
  "knoll", "knots", "known", "kudos", "label", "laced", "lacks", "ladle", "lager", "lance",
  "lands", "lanes", "lapel", "lapse", "latch", "latex", "lathe", "latte", "lawns", "leads",
  "leafy", "leaky", "leaps", "leapt", "ledge", "lefty", "leggy", "lemma", "lemur", "lever",
  "lilac", "limbo", "limbs", "limed", "lined", "linen", "liner", "lines", "links", "lions",
  "liter", "lithe", "lived", "liver", "livid", "llama", "loads", "loafs", "loamy", "loans",
  "lobby", "local", "locks", "locus", "lodge", "lofty", "logic", "login", "looks", "loops",
  "loose", "lorry", "lotus", "lousy", "lover", "loves", "lower", "loyal", "lucid", "lucky",
  "lumen", "lumps", "lumpy", "lunar", "lunch", "lunge", "lurch", "lusty", "lying", "lymph",
  "lyric", "macho", "macro", "magic", "major", "maker", "mango", "mania", "manor", "maple",
  "march", "marsh", "mason", "match", "mated", "maxim", "mayor", "meals", "meant", "medal",
  "media", "medic", "melee", "melon", "mercy", "merge", "merit", "merry", "metal", "meter",
  "micro", "midst", "might", "mince", "minds", "miner", "minor", "minus", "mirth", "miser",
  "misty", "mixer", "mocha", "model", "moist", "molar", "money", "monks", "month", "moody",
  "moose", "moral", "morph", "motor", "motto", "mound", "mount", "mourn", "mouse", "mouth",
  "moved", "movie", "muddy", "mural", "music", "musty", "naive", "named", "nanny", "nasal",
  "nasty", "naval", "nerdy", "nerve", "never", "niche", "night", "ninja", "noble", "noise",
  "nomad", "north", "notch", "noted", "novel", "nudge", "nurse", "nylon", "oasis", "occur",
  "ocean", "oddly", "offal", "offer", "olive", "onset", "opera", "optic", "orbit", "order",
  "organ", "other", "otter", "ought", "ounce", "outdo", "outer", "owned", "owner", "oxide",
  "ozone", "paced", "packs", "paddy", "paint", "pairs", "panel", "panic", "paper", "party",
  "pasta", "paste", "patch", "patio", "pause", "peace", "peach", "pearl", "pecan", "pedal",
  "penny", "perch", "peril", "perky", "petal", "phase", "photo", "piano", "picks", "piece",
  "pilot", "pinch", "pitch", "pixel", "pizza", "place", "plaid", "plain", "plane", "plank",
  "plant", "plate", "plaza", "plead", "pleat", "plied", "pluck", "plumb", "plume", "plump",
  "plunk", "plush", "plyer", "poach", "poems", "point", "poise", "poker", "polar", "polls",
  "poppy", "porch", "poses", "posse", "pouch", "pound", "power", "prank", "prawn", "press",
  "price", "prick", "pride", "prime", "print", "prior", "prism", "privy", "prize", "probe",
  "prone", "prong", "proof", "prose", "proud", "prove", "prowl", "prude", "prune", "psalm",
  "pulse", "pumps", "punch", "pupil", "puppy", "purge", "purse", "pushy", "putty", "quack",
  "quaff", "quail", "qualm", "quart", "quasi", "queen", "query", "quest", "queue", "quick",
  "quiet", "quill", "quirk", "quota", "quote", "rabbi", "radar", "radio", "rainy", "raise",
  "rally", "ranch", "range", "ranks", "rapid", "raven", "rayon", "reach", "react", "ready",
  "realm", "rebel", "rebus", "recap", "recon", "recur", "refer", "rehab", "relax", "relay",
  "relic", "remit", "renew", "repay", "repel", "reply", "resin", "retro", "retry", "reuse",
  "revel", "rider", "ridge", "rifle", "right", "rigid", "rigor", "rinse", "ripen", "risen",
  "risky", "rival", "river", "rivet", "roast", "robot", "rocky", "rogue", "roots", "roost",
  "rough", "round", "route", "rover", "royal", "rugby", "ruins", "ruler", "rumba", "rumor",
  "rupee", "rural", "rusty", "sadly", "saint", "salad", "salon", "salsa", "salty", "salve",
  "sandy", "satin", "sauce", "sauna", "savor", "scale", "scalp", "scald", "scamp", "scant",
  "scare", "scarf", "scary", "scene", "scent", "scope", "score", "scorn", "scout", "scowl",
  "scram", "scrap", "screw", "scrub", "seize", "sense", "serve", "setup", "seven", "shade",
  "shaft", "shake", "shall", "shame", "shape", "share", "shark", "sharp", "shawl", "shear",
  "sheen", "sheep", "sheer", "sheet", "shelf", "shell", "shift", "shine", "shiny", "shire",
  "shirt", "shock", "shore", "short", "shout", "shove", "shown", "showy", "shrub", "shrug",
  "siege", "sight", "sigma", "silly", "since", "siren", "sixth", "sixty", "skate", "skill",
  "skimp", "skull", "skunk", "slack", "slain", "slang", "slant", "slash", "slate", "sleek",
  "sleep", "sleet", "slept", "slice", "slide", "slime", "slimy", "sling", "slink", "slope",
  "sloth", "slugs", "slump", "slung", "slurp", "smart", "smash", "smell", "smelt", "smile",
  "smirk", "smith", "smoke", "smoky", "snack", "snail", "snake", "snare", "snarl", "sneak",
  "sneer", "snide", "sniff", "snore", "snout", "solar", "solid", "solve", "sonic", "sorry",
  "sound", "south", "space", "spade", "spare", "spark", "spawn", "speak", "spear", "speck",
  "speed", "spell", "spend", "spent", "spice", "spicy", "spied", "spill", "spine", "spite",
  "split", "spoke", "spoof", "spook", "spool", "spoon", "sport", "spout", "spray", "spree",
  "sprig", "spunk", "squad", "squat", "squid", "stack", "staff", "stage", "stain", "stair",
  "stake", "stale", "stalk", "stall", "stamp", "stand", "stank", "stare", "stark", "start",
  "stash", "state", "stays", "steak", "steal", "steam", "steel", "steep", "steer", "stems",
  "stick", "stiff", "still", "sting", "stink", "stint", "stock", "stoic", "stoke", "stole",
  "stomp", "stone", "stood", "stool", "stoop", "stops", "store", "storm", "story", "stout",
  "stove", "strap", "straw", "stray", "strip", "strum", "strut", "stuck", "stuff", "stump",
  "stung", "stunk", "stunt", "style", "suave", "sugar", "suite", "sulky", "sunny", "super",
  "surge", "sushi", "swamp", "swank", "swarm", "swath", "swear", "sweat", "sweep", "sweet",
  "swept", "swift", "swill", "swine", "swing", "swipe", "swirl", "sword", "swore", "sworn",
  "swung", "syrup", "table", "taboo", "tacit", "taffy", "taint", "taken", "tales", "tally",
  "talon", "tango", "tangy", "taper", "tapir", "tardy", "taste", "tasty", "taunt", "tease",
  "teeth", "tempo", "tenet", "tenor", "tense", "tenth", "tepee", "tepid", "terms", "terra",
  "terse", "theme", "there", "thick", "thief", "thigh", "thing", "think", "third", "thorn",
  "those", "three", "threw", "throw", "thrum", "thumb", "thump", "tidal", "tiger", "tight",
  "tilts", "timer", "timid", "tinge", "tipsy", "titan", "title", "toast", "today", "token",
  "total", "totem", "touch", "tough", "towel", "tower", "toxic", "trace", "track", "trade",
  "trail", "train", "trait", "tramp", "trash", "trawl", "treat", "trend", "triad", "trial",
  "tribe", "trick", "tried", "trill", "tripe", "trite", "troll", "troop", "trout", "truck",
  "truly", "trump", "trunk", "truss", "trust", "truth", "tulip", "tumor", "tuner", "tunny",
  "turbo", "tutor", "twang", "tweak", "tweed", "tweet", "twice", "twine", "twist", "udder",
  "ultra", "uncut", "under", "undid", "undue", "unfed", "unfit", "unify", "union", "unite",
  "unity", "unlit", "until", "unwed", "upper", "upset", "urban", "usage", "usher", "using",
  "usual", "utter", "vague", "valid", "valor", "value", "valve", "vault", "vegan", "veins",
  "venue", "verge", "verse", "vigor", "villa", "vinyl", "viola", "viper", "viral", "visor",
  "vista", "vital", "vivid", "vocal", "vodka", "vogue", "voice", "voila", "voter", "vouch",
  "vowel", "vying", "wacky", "wager", "wagon", "waist", "watch", "water", "weary", "weave",
  "wedge", "weigh", "weird", "wheat", "wheel", "where", "which", "while", "whine", "whirl",
  "whisk", "white", "whole", "whose", "widen", "wider", "widow", "width", "wield", "windy",
  "witch", "witty", "woken", "woman", "women", "world", "worry", "worse", "worst", "worth",
  "would", "wound", "wrath", "wreak", "wreck", "wring", "wrist", "write", "wrong", "wrote",
  "yacht", "yield", "young", "youth", "zebra", "zesty",
]);

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

/** Check if a word is a valid 5-letter guess */
export function isValidGuess(word: string): boolean {
  return word.length === 5 && VALID_WORDS.has(word.toLowerCase());
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
