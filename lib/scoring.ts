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
      { maxMs: 180, score: 100 },
      { maxMs: 320, score: 85 },
      { maxMs: 500, score: 70 },
      { maxMs: 800, score: 55 },
      { maxMs: 1200, score: 40 },
      { maxMs: 1800, score: 25 },
      { maxMs: 2600, score: 12 },
    ],
    late: [
      { maxMs: 180, score: 100 },
      { maxMs: 320, score: 90 },
      { maxMs: 500, score: 75 },
      { maxMs: 800, score: 60 },
      { maxMs: 1200, score: 45 },
      { maxMs: 1800, score: 30 },
      { maxMs: 2600, score: 15 },
      { maxMs: 3500, score: 8 },
    ],
  },
  cs2: {
    early: [
      { maxMs: 110, score: 100 },
      { maxMs: 190, score: 55 },
      { maxMs: 320, score: 28 },
      { maxMs: 560, score: 12 },
      { maxMs: 850, score: 4 },
    ],
    late: [
      { maxMs: 110, score: 100 },
      { maxMs: 190, score: 62 },
      { maxMs: 320, score: 32 },
      { maxMs: 560, score: 14 },
      { maxMs: 900, score: 6 },
      { maxMs: 1300, score: 2 },
    ],
  },
};

export const EVENT_GRACE_MS_BY_GAME: Record<GameScoreMode, number> = {
  football: 1000,
  cs2: 1000,
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
