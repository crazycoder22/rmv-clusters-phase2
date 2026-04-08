// ── Seeded PRNG ──────────────────────────────────────────────────────────────

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

// ── Game Code Generation ─────────────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

export function generateGameCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ── Ticket Generation ────────────────────────────────────────────────────────
// Standard Tambola ticket: 3 rows × 9 columns
// - 15 numbers total (5 per row, 4 blanks per row)
// - Column 0: 1-9, Column 1: 10-19, ..., Column 8: 80-90
// - Each column has 1-3 numbers
// - Numbers sorted ascending within each column

/** Column number ranges */
function getColumnRange(col: number): number[] {
  if (col === 0) return Array.from({ length: 9 }, (_, i) => i + 1); // 1-9
  if (col === 8) return Array.from({ length: 11 }, (_, i) => i + 80); // 80-90
  return Array.from({ length: 10 }, (_, i) => col * 10 + i); // 10-19, 20-29, etc.
}

export function generateTicket(sessionId: string, playerId: string): number[][] {
  const seed = hashString(sessionId + ":" + playerId);
  const rng = mulberry32(seed);

  // Step 1: Decide how many numbers per column (1-3 each, total = 15)
  const colCounts = [1, 1, 1, 1, 1, 1, 1, 1, 1]; // start with 1 each = 9
  let remaining = 6; // need 6 more to reach 15
  while (remaining > 0) {
    const col = Math.floor(rng() * 9);
    if (colCounts[col] < 3) {
      colCounts[col]++;
      remaining--;
    }
  }

  // Step 2: Pick random numbers for each column
  const colNumbers: number[][] = [];
  for (let col = 0; col < 9; col++) {
    const range = getColumnRange(col);
    const picked = shuffle(range, rng).slice(0, colCounts[col]);
    picked.sort((a, b) => a - b);
    colNumbers.push(picked);
  }

  // Step 3: Assign numbers to rows (each row must have exactly 5)
  const grid: number[][] = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  const rowCounts = [0, 0, 0];

  // For columns with 3 numbers: fill all 3 rows
  for (let col = 0; col < 9; col++) {
    if (colCounts[col] === 3) {
      grid[0][col] = colNumbers[col][0];
      grid[1][col] = colNumbers[col][1];
      grid[2][col] = colNumbers[col][2];
      rowCounts[0]++;
      rowCounts[1]++;
      rowCounts[2]++;
    }
  }

  // For columns with 2 numbers: pick 2 rows
  for (let col = 0; col < 9; col++) {
    if (colCounts[col] === 2) {
      // Pick 2 rows that have the fewest numbers so far
      const rows = [0, 1, 2].sort((a, b) => rowCounts[a] - rowCounts[b] || rng() - 0.5);
      const selected = rows.slice(0, 2).sort((a, b) => a - b);
      grid[selected[0]][col] = colNumbers[col][0];
      grid[selected[1]][col] = colNumbers[col][1];
      rowCounts[selected[0]]++;
      rowCounts[selected[1]]++;
    }
  }

  // For columns with 1 number: pick 1 row
  for (let col = 0; col < 9; col++) {
    if (colCounts[col] === 1) {
      // Pick the row with fewest numbers
      const rows = [0, 1, 2].sort((a, b) => rowCounts[a] - rowCounts[b] || rng() - 0.5);
      const row = rows[0];
      grid[row][col] = colNumbers[col][0];
      rowCounts[row]++;
    }
  }

  // Verify: each row should have exactly 5 numbers
  // If not balanced (rare edge case), do a fixup pass
  for (let attempts = 0; attempts < 50; attempts++) {
    const counts = grid.map((row) => row.filter((n) => n !== 0).length);
    if (counts[0] === 5 && counts[1] === 5 && counts[2] === 5) break;

    // Find an overloaded row and an underloaded row
    const overIdx = counts.indexOf(Math.max(...counts));
    const underIdx = counts.indexOf(Math.min(...counts));
    if (overIdx === underIdx) break;

    // Find a column in the overloaded row that can be moved
    for (let col = 0; col < 9; col++) {
      if (grid[overIdx][col] !== 0 && grid[underIdx][col] === 0 && colCounts[col] === 1) {
        grid[underIdx][col] = grid[overIdx][col];
        grid[overIdx][col] = 0;
        break;
      }
    }
  }

  return grid;
}

// ── Prize Validation ─────────────────────────────────────────────────────────

function getTicketNumbers(ticket: number[][]): number[] {
  return ticket.flat().filter((n) => n !== 0);
}

function getRowNumbers(ticket: number[][], row: number): number[] {
  return ticket[row].filter((n) => n !== 0);
}

export function validateEarlyFive(ticket: number[][], drawnNumbers: number[]): boolean {
  const drawn = new Set(drawnNumbers);
  const marked = getTicketNumbers(ticket).filter((n) => drawn.has(n));
  return marked.length >= 5;
}

export function validateTopLine(ticket: number[][], drawnNumbers: number[]): boolean {
  const drawn = new Set(drawnNumbers);
  return getRowNumbers(ticket, 0).every((n) => drawn.has(n));
}

export function validateMiddleLine(ticket: number[][], drawnNumbers: number[]): boolean {
  const drawn = new Set(drawnNumbers);
  return getRowNumbers(ticket, 1).every((n) => drawn.has(n));
}

export function validateBottomLine(ticket: number[][], drawnNumbers: number[]): boolean {
  const drawn = new Set(drawnNumbers);
  return getRowNumbers(ticket, 2).every((n) => drawn.has(n));
}

export function validateFullHouse(ticket: number[][], drawnNumbers: number[]): boolean {
  const drawn = new Set(drawnNumbers);
  return getTicketNumbers(ticket).every((n) => drawn.has(n));
}

export type PrizeType = "EARLY_FIVE" | "TOP_LINE" | "MIDDLE_LINE" | "BOTTOM_LINE" | "FULL_HOUSE";

export function validatePrize(prizeType: PrizeType, ticket: number[][], drawnNumbers: number[]): boolean {
  switch (prizeType) {
    case "EARLY_FIVE": return validateEarlyFive(ticket, drawnNumbers);
    case "TOP_LINE": return validateTopLine(ticket, drawnNumbers);
    case "MIDDLE_LINE": return validateMiddleLine(ticket, drawnNumbers);
    case "BOTTOM_LINE": return validateBottomLine(ticket, drawnNumbers);
    case "FULL_HOUSE": return validateFullHouse(ticket, drawnNumbers);
  }
}

export const PRIZE_LABELS: Record<PrizeType, string> = {
  EARLY_FIVE: "Early Five",
  TOP_LINE: "Top Line",
  MIDDLE_LINE: "Middle Line",
  BOTTOM_LINE: "Bottom Line",
  FULL_HOUSE: "Full House",
};

export const PRIZE_ORDER: PrizeType[] = [
  "EARLY_FIVE", "TOP_LINE", "MIDDLE_LINE", "BOTTOM_LINE", "FULL_HOUSE",
];
