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
      { maxMs: 100, score: 50 },
      { maxMs: 200, score: 35 },
      { maxMs: 400, score: 20 },
      { maxMs: 800, score: 8 },
    ],
    late: [
      { maxMs: 200, score: 65 },
      { maxMs: 400, score: 45 },
      { maxMs: 700, score: 25 },
      { maxMs: 1200, score: 8 },
    ],
  },
  cs2: {
    early: [
      { maxMs: 100, score: 25 },
      { maxMs: 200, score: 12 },
      { maxMs: 400, score: 5 },
      { maxMs: 800, score: 1 },
    ],
    late: [
      { maxMs: 200, score: 45 },
      { maxMs: 400, score: 18 },
      { maxMs: 700, score: 6 },
      { maxMs: 1200, score: 2 },
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
