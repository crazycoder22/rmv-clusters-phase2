export const TEAM_SIZE = 5;
export const MIN_BOWLERS = 1;
export const MAX_BOWLERS = 2;
export const MAX_BATSMEN = 3;

export type FantasyRole = "BATSMAN" | "BOWLER" | "ALLROUNDER" | "WICKETKEEPER";

export const ROLE_LABELS: Record<FantasyRole, string> = {
  BATSMAN: "Batsman",
  BOWLER: "Bowler",
  ALLROUNDER: "All-rounder",
  WICKETKEEPER: "Wicketkeeper",
};

export function validateTeam(
  players: { role: FantasyRole }[],
  captainId: string | null,
  viceCaptainId: string | null
): string | null {
  if (players.length !== TEAM_SIZE) return `Pick exactly ${TEAM_SIZE} players`;
  if (!captainId) return "Select a captain";
  if (!viceCaptainId) return "Select a vice-captain";
  if (captainId === viceCaptainId) return "Captain and VC must differ";
  const bowlers = players.filter((p) => p.role === "BOWLER").length;
  const batsmen = players.filter((p) => p.role === "BATSMAN").length;
  if (bowlers < MIN_BOWLERS) return `Include at least ${MIN_BOWLERS} bowler`;
  if (bowlers > MAX_BOWLERS) return `At most ${MAX_BOWLERS} bowlers`;
  if (batsmen > MAX_BATSMEN) return `At most ${MAX_BATSMEN} batsmen`;
  return null;
}
