// Shared fantasy league utilities

export interface ScoreSnapshot {
  runs: number;
  wickets: number;
  catches: number;
  runOuts: number;
  stumpings: number;
}

/** Raw points from a player's score (before captain multiplier) */
export function computeBasePoints(score: ScoreSnapshot): number {
  return (
    score.runs * 1 +
    score.wickets * 30 +
    score.catches * 20 +
    score.runOuts * 20 +
    score.stumpings * 20
  );
}

/** Apply captain (2×) or vice-captain (1.5×) multiplier */
export function applyMultiplier(
  base: number,
  isCaptain: boolean,
  isViceCaptain: boolean
): number {
  if (isCaptain) return Math.round(base * 2);
  if (isViceCaptain) return Math.round(base * 1.5);
  return base;
}

// Team validation constants
export const TEAM_SIZE = 5;
export const MIN_BOWLERS = 1;
export const MAX_BOWLERS = 2;
export const MAX_BATSMEN = 3;
