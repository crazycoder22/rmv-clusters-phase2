/** Generate a random 6-character alphanumeric game code */
export function generateQuizCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Calculate points for a correct answer based on response time.
 * Max 1000 points, min 100 points (if correct).
 * Faster response = more points.
 */
export function calculatePoints(
  responseMs: number,
  timeLimitSecs: number,
  isCorrect: boolean
): number {
  if (!isCorrect) return 0;
  const timeLimitMs = timeLimitSecs * 1000;
  const ratio = Math.min(responseMs / timeLimitMs, 1);
  // Linear: 1000 at instant, 100 at time limit
  return Math.round(1000 - ratio * 900);
}
