export type GameScoreMode = "football" | "cs2";

type ScoreStep = {
  maxMs: number;
  score: number;
};

type ScoreProfile = {
  early: ScoreStep[];
  late: ScoreStep[];
};

const SCORE_PROFILES: Record<GameScoreMode, ScoreProfile> = {
  football: {
    early: [
      { maxMs: 120, score: 100 },
      { maxMs: 220, score: 60 },
      { maxMs: 400, score: 30 },
      { maxMs: 800, score: 10 },
    ],
    late: [
      { maxMs: 120, score: 100 },
      { maxMs: 220, score: 75 },
      { maxMs: 400, score: 40 },
      { maxMs: 700, score: 15 },
      { maxMs: 1200, score: 4 },
    ],
  },
  cs2: {
    early: [
      { maxMs: 90, score: 100 },
      { maxMs: 160, score: 45 },
      { maxMs: 280, score: 18 },
      { maxMs: 500, score: 6 },
      { maxMs: 800, score: 2 },
    ],
    late: [
      { maxMs: 90, score: 100 },
      { maxMs: 160, score: 55 },
      { maxMs: 280, score: 22 },
      { maxMs: 500, score: 8 },
      { maxMs: 800, score: 3 },
      { maxMs: 1200, score: 1 },
    ],
  },
};

export const EVENT_GRACE_MS_BY_GAME: Record<GameScoreMode, number> = {
  football: 700,
  cs2: 700,
};

export function calculateScoreForGame(gameMode: GameScoreMode, signedDiffMs: number): number {
  const profile = SCORE_PROFILES[gameMode];
  const diffMs = Math.abs(signedDiffMs);
  const steps = signedDiffMs >= 0 ? profile.late : profile.early;

  for (const step of steps) {
    if (diffMs <= step.maxMs) {
      return step.score;
    }
  }

  return 0;
}
