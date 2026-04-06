"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateScoreForGame, EVENT_GRACE_MS_BY_GAME } from "@/lib/scoring";

type EventConfig = {
  id: string;
  eventTimeMs: number;
};

type SubmissionData = {
  guessed_time_ms: number;
  delta_ms: number;
  score: number;
};

type ProgressSubmission = SubmissionData & {
  event_id: string;
};

type ResultEntry = {
  eventId: string;
  eventNumber: number;
  eventTimeMs: number;
  guessedTimeMs: number | null;
  deltaMs: number | null;
  signedDeltaMs: number | null;
  score: number;
  isPersisted?: boolean;
  guessKind?: GuessKind;
  isMissed?: boolean;
};

type GuessKind = "goal" | "kill" | "headshot";

type PendingGuess = {
  roundSeq?: number;
  eventId: string;
  eventIndex: number;
  eventTimeMs: number;
  guessedTimeMs: number;
  deltaMs: number;
  signedDeltaMs: number;
  score: number;
  guessKind: GuessKind;
};

type GameMode = "football" | "cs2";

const GAMES: Record<
  GameMode,
  {
    title: string;
    videoSrc: string;
    promptTitle: string;
    events: EventConfig[];
  }
> = {
  football: {
    title: "Футбол",
    videoSrc: "/demo.mp4",
    promptTitle: "Угадайте момент наступления гола",
    events: [{ id: "00000000-0000-0000-0000-000000000002", eventTimeMs: 3750 }],
  },
  cs2: {
    title: "CS2",
    videoSrc: "/demo2.mp4",
    promptTitle: "Угадайте момент убийства",
    events: [
      { id: "00000000-0000-0000-0000-000000000003", eventTimeMs: 3750 },
      { id: "00000000-0000-0000-0000-000000000004", eventTimeMs: 6820 },
      { id: "00000000-0000-0000-0000-000000000005", eventTimeMs: 8290 },
      { id: "00000000-0000-0000-0000-000000000006", eventTimeMs: 9280 },
      { id: "00000000-0000-0000-0000-000000000007", eventTimeMs: 15700 },
      { id: "00000000-0000-0000-0000-000000000008", eventTimeMs: 19976 },
      { id: "00000000-0000-0000-0000-000000000009", eventTimeMs: 21200 },
      { id: "00000000-0000-0000-0000-00000000000a", eventTimeMs: 24700 },
      { id: "00000000-0000-0000-0000-00000000000b", eventTimeMs: 26700 },
    ],
  },
};

const CALIBRATION_SAMPLE_COUNT = 3;
const CALIBRATION_DELAY_MIN_MS = 3000;
const CALIBRATION_DELAY_MAX_MS = 7000;

function getEventDisplayLabel(mode: GameMode, eventNumber: number): string {
  if (mode === "football") {
    return `Событие ${eventNumber} гол`;
  }

  return `Событие ${eventNumber} headshot`;
}

function getMaxScoreForGuessKind(kind: GuessKind): number {
  if (kind === "kill") return 50;
  return 100;
}

function applyGuessKindScore(baseScore: number, kind: GuessKind): number {
  if (kind === "kill") {
    return Math.round(baseScore / 2);
  }

  return baseScore;
}

function getScoreColorClass(value: number | null): string {
  if (value === null) return "text-zinc-900";
  if (value >= 35) return "text-green-700";
  if (value >= 12) return "text-amber-600";
  return "text-red-600";
}

function getRankEmoji(rank: number): string {
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function formatEventTimeMs(eventTimeMs: number): string {
  return `${(eventTimeMs / 1000).toFixed(3)}с`;
}

function formatSignedDeltaMs(signedDeltaMs: number | null): string {
  if (signedDeltaMs === null) return "-";
  if (signedDeltaMs === 0) return "0.000с";
  return `${signedDeltaMs > 0 ? "+" : "-"}${(Math.abs(signedDeltaMs) / 1000).toFixed(3)}с`;
}

function formatSecondsFromMs(valueMs: number): string {
  return `${(valueMs / 1000).toFixed(3)}с`;
}

function resolveCurrentEventIndex(
  timeMs: number,
  startIndex: number,
  events: EventConfig[],
  eventGraceMs: number
): number {
  let nextIndex = startIndex;

  while (nextIndex < events.length && timeMs > events[nextIndex].eventTimeMs + eventGraceMs) {
    nextIndex += 1;
  }

  return nextIndex;
}

export default function GamePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const restoreSeqRef = useRef(0);
  const roundSeqRef = useRef(0);
  const maxWatchedMsRef = useRef(0);
  const suppressSeekGuardRef = useRef(false);
  const calibrationTimeoutRef = useRef<number | null>(null);
  const calibrationSignalStartedAtRef = useRef<number | null>(null);

  const [mode, setMode] = useState<GameMode>("football");
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  const [playerName, setPlayerName] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);
  const [submittedEventIds, setSubmittedEventIds] = useState<string[]>([]);

  const [guessedTimeMs, setGuessedTimeMs] = useState<number | null>(null);
  const [eventTimeMs, setEventTimeMs] = useState<number | null>(null);
  const [signedDeltaMs, setSignedDeltaMs] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [lastGuessKind, setLastGuessKind] = useState<GuessKind>("goal");
  const [eventFeedback, setEventFeedback] = useState<string | null>(null);
  const [eventFeedbackType, setEventFeedbackType] = useState<"hit" | "miss" | null>(null);
  const [maxHitFxToken, setMaxHitFxToken] = useState(0);
  const [maxHitFxLabel, setMaxHitFxLabel] = useState<string | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [resultHistory, setResultHistory] = useState<ResultEntry[]>([]);

  const [pendingGuess, setPendingGuess] = useState<PendingGuess | null>(null);
  const [cancelAttemptsLeft, setCancelAttemptsLeft] = useState(1);
  const [currentVideoMs, setCurrentVideoMs] = useState(0);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [hasVideoStarted, setHasVideoStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeekUnlocked, setIsSeekUnlocked] = useState(false);

  const [videoError, setVideoError] = useState(false);
  const [inFlightEventIds, setInFlightEventIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<Array<{ rank: number; name: string; score: number; delta: number }>>([]);
  const [playerRow, setPlayerRow] = useState<{ rank: number; name: string; score: number; delta: number } | null>(null);
  const [bridgeRow, setBridgeRow] = useState<{ rank: number; name: string; score: number; delta: number } | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [isRestoringProgress, setIsRestoringProgress] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [practiceModeByGame, setPracticeModeByGame] = useState<Record<GameMode, boolean>>({
    football: false,
    cs2: false,
  });
  const [hasPlayedByGame, setHasPlayedByGame] = useState<Record<GameMode, boolean>>({
    football: false,
    cs2: false,
  });
  const [calibrationOffsetMs, setCalibrationOffsetMs] = useState(0);
  const [calibrationSamples, setCalibrationSamples] = useState<number[]>([]);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrationSignalVisible, setIsCalibrationSignalVisible] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState<string | null>(null);

  const selectedGame = useMemo(() => GAMES[mode], [mode]);
  const isPracticeMode = practiceModeByGame[mode];
  const canUsePracticeMode = hasPlayedByGame[mode];
  const currentEvent = selectedGame.events[currentEventIndex] ?? null;
  const eventGraceMs = EVENT_GRACE_MS_BY_GAME[mode];
  const lastEvent = selectedGame.events[selectedGame.events.length - 1] ?? null;
  const hasReachedLastEvent = !!lastEvent && currentVideoMs >= lastEvent.eventTimeMs;
  const canSeekFreely = isPracticeMode || isSeekUnlocked || selectedGame.events.length === 0 || currentEvent === null;
  const replayProgressPercent =
    videoDurationMs > 0
      ? Math.max(0, Math.min(100, (Math.min(currentVideoMs, videoDurationMs) / videoDurationMs) * 100))
      : 0;
  const blockedEventIds = useMemo(() => {
    const ids = [...submittedEventIds, ...inFlightEventIds];
    if (pendingGuess) ids.push(pendingGuess.eventId);
    return [...new Set(ids)];
  }, [submittedEventIds, inFlightEventIds, pendingGuess]);

  useEffect(() => {
    if (maxHitFxToken === 0) return;

    const timer = window.setTimeout(() => {
      setMaxHitFxLabel(null);
    }, 1300);

    return () => window.clearTimeout(timer);
  }, [maxHitFxToken]);

  const visibleEventRows = useMemo(() => {
    const byEventId = new Map(resultHistory.map((item) => [item.eventId, item]));
    const completedCount = Math.max(0, Math.min(currentEventIndex, selectedGame.events.length));
    const rows: Array<ResultEntry | { eventNumber: number; eventTimeMs: number; isMissed: true }> = [];

    for (let index = 0; index < completedCount; index += 1) {
      const event = selectedGame.events[index];
      if (!event) continue;

      const existing = byEventId.get(event.id);
      if (existing) {
        rows.push(existing);
      } else {
        rows.push({
          eventNumber: index + 1,
          eventTimeMs: event.eventTimeMs,
          isMissed: true,
        });
      }
    }

    return rows;
  }, [resultHistory, currentEventIndex, selectedGame.events]);

  const moveToEventIndex = (index: number) => {
    setCurrentEventIndex(index);
    setPendingGuess(null);
    setCancelAttemptsLeft(1);
  };

  const markMissedEvents = (fromIndex: number, toIndexExclusive: number) => {
    if (toIndexExclusive <= fromIndex) return;

    const existingIds = new Set(resultHistory.map((item) => item.eventId));
    const missedEvents: EventConfig[] = [];

    for (let index = fromIndex; index < toIndexExclusive; index += 1) {
      const event = selectedGame.events[index];
      if (!event) continue;
      if (existingIds.has(event.id)) continue;
      if (blockedEventIds.includes(event.id)) continue;
      missedEvents.push(event);
      existingIds.add(event.id);
    }

    if (missedEvents.length === 0) return;

    setResultHistory((prev) => {
      const next = [...prev];

      for (const event of missedEvents) {
        next.push({
          eventId: event.id,
          eventNumber: selectedGame.events.findIndex((item) => item.id === event.id) + 1,
          eventTimeMs: event.eventTimeMs,
          guessedTimeMs: null,
          deltaMs: null,
          signedDeltaMs: null,
          score: 0,
          isPersisted: true,
          isMissed: true,
        });
      }

      return next.sort((a, b) => a.eventNumber - b.eventNumber);
    });

    const lastMissedEvent = missedEvents[missedEvents.length - 1];
    const missedEventNumber = selectedGame.events.findIndex((item) => item.id === lastMissedEvent.id) + 1;
    setGuessedTimeMs(null);
    setEventTimeMs(lastMissedEvent.eventTimeMs);
    setSignedDeltaMs(null);
    setScore(0);
    setEventFeedback(`Событие ${missedEventNumber} пропущено (очки: 0)`);
    setEventFeedbackType("miss");
  };

  const clearCalibrationTimeout = () => {
    if (calibrationTimeoutRef.current !== null) {
      window.clearTimeout(calibrationTimeoutRef.current);
      calibrationTimeoutRef.current = null;
    }
  };

  const runCalibrationRound = () => {
    clearCalibrationTimeout();
    setIsCalibrationSignalVisible(false);
    calibrationSignalStartedAtRef.current = null;

    const randomDelayMs =
      CALIBRATION_DELAY_MIN_MS + Math.floor(Math.random() * (CALIBRATION_DELAY_MAX_MS - CALIBRATION_DELAY_MIN_MS + 1));

    calibrationTimeoutRef.current = window.setTimeout(() => {
      calibrationSignalStartedAtRef.current = performance.now();
      setIsCalibrationSignalVisible(true);
      calibrationTimeoutRef.current = null;
    }, randomDelayMs);
  };

  const finishCalibration = (samples: number[]) => {
    if (samples.length === 0) {
      setCalibrationOffsetMs(0);
      setCalibrationMessage("Калибровка сброшена");
      localStorage.removeItem("calibrationOffsetMs");
      return;
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const boundedMedian = Math.max(80, Math.min(350, Math.round(median)));
    setCalibrationOffsetMs(boundedMedian);
    setCalibrationMessage(`Калибровка сохранена: ${formatSecondsFromMs(boundedMedian)}`);
    localStorage.setItem("calibrationOffsetMs", String(boundedMedian));
  };

  const resetRound = () => {
    roundSeqRef.current += 1;
    setCurrentEventIndex(0);
    setSubmittedEventIds([]);
    setInFlightEventIds([]);
    setGuessedTimeMs(null);
    setEventTimeMs(null);
    setSignedDeltaMs(null);
    setScore(null);
    setLastGuessKind(mode === "football" ? "goal" : "headshot");
    setEventFeedback(null);
    setEventFeedbackType(null);
    setResultHistory([]);
    setPendingGuess(null);
    setCancelAttemptsLeft(1);
    setSubmitError(null);
    setCurrentVideoMs(0);
    setVideoDurationMs(0);
    setHasVideoStarted(false);
    setIsPlaying(false);
    setIsSeekUnlocked(false);
    maxWatchedMsRef.current = 0;
  };

  const fetchLeaderboard = async (gameMode: GameMode) => {
    try {
      setIsLoadingLeaderboard(true);
      const query = new URLSearchParams({ mode: gameMode });
      if (playerName) {
        query.set("player_name", playerName);
      }

      const response = await fetch(`/api/leaderboard?${query.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
        setPlayerRow(data.player_row || null);
        setBridgeRow(data.bridge_row || null);
      } else {
        setLeaderboard([]);
        setPlayerRow(null);
        setBridgeRow(null);
      }
    } catch (error) {
      console.error("Не удалось загрузить таблицу лидеров:", error);
      setLeaderboard([]);
      setPlayerRow(null);
      setBridgeRow(null);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const getSubmission = async (name: string, eventId: string): Promise<SubmissionData | null> => {
    try {
      const response = await fetch(
        `/api/check-submission?player_name=${encodeURIComponent(name)}&event_id=${encodeURIComponent(eventId)}`
      );
      if (!response.ok) return null;

      const data = await response.json();
      return data.has_submitted && data.submission ? data.submission : null;
    } catch (error) {
      console.error("Не удалось проверить отправку:", error);
      return null;
    }
  };

  const getProgressSubmissions = async (name: string, gameMode: GameMode): Promise<ProgressSubmission[]> => {
    try {
      const response = await fetch(`/api/player-progress?player_name=${encodeURIComponent(name)}&mode=${encodeURIComponent(gameMode)}`);
      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data.submissions) ? data.submissions : [];
    } catch (error) {
      console.error("Не удалось загрузить прогресс:", error);
      return [];
    }
  };

  const restoreProgress = async (name: string, gameMode: GameMode) => {
    const requestId = ++restoreSeqRef.current;
    setIsRestoringProgress(true);
    const events = GAMES[gameMode].events;
    const submissions = await getProgressSubmissions(name, gameMode);
    if (requestId !== restoreSeqRef.current) return;

    const byEventId = new Map(submissions.map((item) => [item.event_id, item]));
    const restoredHistory: ResultEntry[] = [];

    for (let i = 0; i < events.length; i += 1) {
      const submission = byEventId.get(events[i].id);
      if (!submission) break;

      restoredHistory.push({
        eventId: events[i].id,
        eventNumber: i + 1,
        eventTimeMs: events[i].eventTimeMs,
        guessedTimeMs: submission.guessed_time_ms,
        deltaMs: submission.delta_ms,
        signedDeltaMs: submission.guessed_time_ms - events[i].eventTimeMs,
        score: submission.score,
        isPersisted: true,
      });
    }

    const nextEventIndex = restoredHistory.length;
    setHasPlayedByGame((prev) => ({ ...prev, [gameMode]: restoredHistory.length > 0 }));

    setResultHistory(restoredHistory);
    setSubmittedEventIds(restoredHistory.map((item) => item.eventId));
    moveToEventIndex(nextEventIndex);
    setSubmitError(null);

    if (restoredHistory.length > 0) {
      const lastScored = [...restoredHistory].reverse().find((entry) => entry.guessedTimeMs !== null) ?? null;
      if (lastScored) {
        setGuessedTimeMs(lastScored.guessedTimeMs);
        setEventTimeMs(lastScored.eventTimeMs);
        setSignedDeltaMs(lastScored.signedDeltaMs);
        setScore(lastScored.score);
      }
    } else {
      setGuessedTimeMs(null);
      setEventTimeMs(null);
      setSignedDeltaMs(null);
      setScore(null);
    }

    if (requestId === restoreSeqRef.current) {
      setIsRestoringProgress(false);
    }
  };

  const submitGuess = async (guess: PendingGuess) => {
    const guessRoundSeq = guess.roundSeq ?? roundSeqRef.current;
    if (guessRoundSeq !== roundSeqRef.current) return;

    setPendingGuess((prev) => (prev && prev.eventId === guess.eventId ? null : prev));
    setInFlightEventIds((prev) => (prev.includes(guess.eventId) ? prev : [...prev, guess.eventId]));
    setSubmitError(null);

    const applyResolvedGuess = (
      resolvedGuess: PendingGuess,
      resolvedSubmission?: SubmissionData | null,
      isPersisted = true,
      shouldRefreshLeaderboard = true
    ) => {
      const resolvedRoundSeq = resolvedGuess.roundSeq ?? guessRoundSeq;
      if (resolvedRoundSeq !== roundSeqRef.current) return;

      const finalGuessedTimeMs = resolvedSubmission?.guessed_time_ms ?? resolvedGuess.guessedTimeMs;
      const finalScore = resolvedSubmission?.score ?? resolvedGuess.score;
      const finalSignedDeltaMs = finalGuessedTimeMs - resolvedGuess.eventTimeMs;
      const finalDeltaMs = Math.abs(finalSignedDeltaMs);

      if (isPersisted) {
        setSubmittedEventIds((prev) => (prev.includes(resolvedGuess.eventId) ? prev : [...prev, resolvedGuess.eventId]));
      }

      setResultHistory((prev) => {
        const next = prev.filter((item) => item.eventId !== resolvedGuess.eventId);
        next.push({
          eventId: resolvedGuess.eventId,
          eventNumber: resolvedGuess.eventIndex + 1,
          eventTimeMs: resolvedGuess.eventTimeMs,
          guessedTimeMs: finalGuessedTimeMs,
          deltaMs: finalDeltaMs,
          signedDeltaMs: finalSignedDeltaMs,
          score: finalScore,
          isPersisted,
          guessKind: resolvedGuess.guessKind,
        });
        return next.sort((a, b) => a.eventNumber - b.eventNumber);
      });

      setGuessedTimeMs(finalGuessedTimeMs);
      setEventTimeMs(resolvedGuess.eventTimeMs);
      setSignedDeltaMs(finalSignedDeltaMs);
      setScore(finalScore);
      setEventFeedback(`Событие ${resolvedGuess.eventIndex + 1} засчитано (очки: ${finalScore})`);
      setEventFeedbackType("hit");
      setHasPlayedByGame((prev) => ({ ...prev, [mode]: true }));

      const maxScoreForClick = getMaxScoreForGuessKind(resolvedGuess.guessKind);
      if (finalScore >= maxScoreForClick) {
        setMaxHitFxLabel(`Идеально! +${maxScoreForClick}`);
        setMaxHitFxToken((prev) => prev + 1);
      }

      moveToEventIndex(resolvedGuess.eventIndex + 1);
      if (shouldRefreshLeaderboard) {
        fetchLeaderboard(mode);
      }
    };

    if (isPracticeMode) {
      applyResolvedGuess(guess, null, true, false);
      return;
    }

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_name: playerName,
          guessed_time_ms: guess.guessedTimeMs,
          event_id: guess.eventId,
          guess_type: guess.guessKind,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409) {
          const existingSubmission = await getSubmission(playerName, guess.eventId);
          applyResolvedGuess(guess, existingSubmission, !!existingSubmission);
        } else {
          applyResolvedGuess(guess, null, false);
          setSubmitError(data.error || "Не удалось сохранить результат. В сумму попадают только сохраненные попытки.");
        }
      } else {
        applyResolvedGuess(guess);
      }
    } catch (error) {
      console.error("Ошибка отправки:", error);
      applyResolvedGuess(guess, null, false);
      setSubmitError("Ошибка сети. В сумму попадают только сохраненные попытки.");
    } finally {
      if (guessRoundSeq === roundSeqRef.current) {
        setInFlightEventIds((prev) => prev.filter((id) => id !== guess.eventId));
      }
    }
  };

  useEffect(() => {
    const savedTotal = resultHistory.reduce((sum, item) => {
      if (item.isPersisted === false) return sum;
      return sum + item.score;
    }, 0);

    setTotalScore(savedTotal);
  }, [resultHistory]);

  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    const savedCalibrationOffset = localStorage.getItem("calibrationOffsetMs");
    const savedMode = localStorage.getItem("gameMode");
    if (savedName) {
      setPlayerName(savedName);
      setIsNameSet(true);
    }

    if (savedCalibrationOffset) {
      const parsed = Number(savedCalibrationOffset);
      if (Number.isFinite(parsed) && parsed >= 0) {
        setCalibrationOffsetMs(parsed);
      }
    }

    if (savedMode === "football" || savedMode === "cs2") {
      setMode(savedMode);
    }

    setIsBootstrapping(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("gameMode", mode);
  }, [mode]);

  useEffect(() => {
    return () => {
      clearCalibrationTimeout();
    };
  }, []);

  useEffect(() => {
    if (isNameSet && playerName) {
      restoreProgress(playerName, mode);
    }
    setVideoError(false);
  }, [isNameSet, playerName, mode]);

  useEffect(() => {
    fetchLeaderboard(mode);
  }, [mode, playerName]);

  useEffect(() => {
    if (!videoRef.current) return;

    const timer = window.setInterval(() => {
      if (!videoRef.current) return;

      const nowMs = Math.round(videoRef.current.currentTime * 1000);
      setCurrentVideoMs(nowMs);

      if (lastEvent && nowMs >= lastEvent.eventTimeMs && !isSeekUnlocked) {
        setIsSeekUnlocked(true);
      }

      if (lastEvent && nowMs >= lastEvent.eventTimeMs && !pendingGuess) {
        markMissedEvents(currentEventIndex, selectedGame.events.length);
        moveToEventIndex(selectedGame.events.length);
        return;
      }

      if (!currentEvent) return;
      if (pendingGuess && pendingGuess.eventId === currentEvent.id) return;

      const nextIndex = resolveCurrentEventIndex(nowMs, currentEventIndex, selectedGame.events, eventGraceMs);
      if (nextIndex !== currentEventIndex) {
        markMissedEvents(currentEventIndex, nextIndex);
        moveToEventIndex(nextIndex);
      }
    }, 120);

    return () => window.clearInterval(timer);
  }, [currentEvent, currentEventIndex, blockedEventIds, selectedGame.events, eventGraceMs, lastEvent, pendingGuess, isSeekUnlocked]);

  useEffect(() => {
    if (!pendingGuess || !currentEvent) return;
    if (pendingGuess.eventId !== currentEvent.id) return;
    if (currentVideoMs < currentEvent.eventTimeMs) return;

    submitGuess(pendingGuess);
  }, [pendingGuess, currentEvent, currentVideoMs]);

  const startCalibration = () => {
    setCalibrationSamples([]);
    setCalibrationMessage("Ожидайте сигнал и нажмите кнопку как можно быстрее");
    setIsCalibrating(true);
    runCalibrationRound();
  };

  const stopCalibration = () => {
    clearCalibrationTimeout();
    setIsCalibrating(false);
    setIsCalibrationSignalVisible(false);
    calibrationSignalStartedAtRef.current = null;
  };

  const resetCalibration = () => {
    stopCalibration();
    setCalibrationSamples([]);
    setCalibrationOffsetMs(0);
    setCalibrationMessage("Калибровка отключена");
    localStorage.removeItem("calibrationOffsetMs");
  };

  const handleCalibrationClick = () => {
    if (!isCalibrating || !isCalibrationSignalVisible) return;
    if (calibrationSignalStartedAtRef.current === null) return;

    const reactionMs = Math.max(0, Math.round(performance.now() - calibrationSignalStartedAtRef.current));
    const nextSamples = [...calibrationSamples, reactionMs];
    setCalibrationSamples(nextSamples);
    setIsCalibrationSignalVisible(false);
    calibrationSignalStartedAtRef.current = null;

    if (nextSamples.length >= CALIBRATION_SAMPLE_COUNT) {
      stopCalibration();
      finishCalibration(nextSamples);
      return;
    }

    setCalibrationMessage(`Тест ${nextSamples.length}/${CALIBRATION_SAMPLE_COUNT} принят. Готовьтесь к следующему`);
    runCalibrationRound();
  };

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      const normalizedName = playerName.trim();
      resetRound();
      setIsNameSet(true);
      setPlayerName(normalizedName);
      localStorage.setItem("playerName", normalizedName);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const nowMs = Math.round(videoRef.current.currentTime * 1000);
    const durationMs = Number.isFinite(videoRef.current.duration)
      ? Math.max(0, Math.round(videoRef.current.duration * 1000))
      : 0;
    setCurrentVideoMs(nowMs);
    if (nowMs > 0 && !hasVideoStarted) {
      setHasVideoStarted(true);
    }
    if (durationMs > 0 && durationMs !== videoDurationMs) {
      setVideoDurationMs(durationMs);
    }
    if (nowMs > maxWatchedMsRef.current) {
      maxWatchedMsRef.current = nowMs;
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (!videoRef.current) return;
    const durationMs = Number.isFinite(videoRef.current.duration)
      ? Math.max(0, Math.round(videoRef.current.duration * 1000))
      : 0;
    setVideoDurationMs(durationMs);
  };

  const handleTogglePlayback = async () => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      try {
        await videoRef.current.play();
      } catch {
        setSubmitError("Не удалось запустить видео");
      }
    } else {
      videoRef.current.pause();
    }
  };

  const handleVideoSeeking = () => {
    if (!videoRef.current) return;
    const nowMs = Math.round(videoRef.current.currentTime * 1000);
    setCurrentVideoMs(nowMs);
    if (nowMs > 0 && !hasVideoStarted) {
      setHasVideoStarted(true);
    }

    if (canSeekFreely) return;
    if (suppressSeekGuardRef.current) {
      suppressSeekGuardRef.current = false;
      return;
    }

    if (nowMs + 80 < maxWatchedMsRef.current) {
      suppressSeekGuardRef.current = true;
      videoRef.current.currentTime = maxWatchedMsRef.current / 1000;
      setSubmitError("Перемотка назад недоступна до последнего события");
    }
  };

  const handleGuess = async (guessKind: GuessKind) => {
    if (!videoRef.current || !currentEvent || hasReachedLastEvent || isRestoringProgress) return;

    const isWaitingForCurrentEvent =
      !!pendingGuess && pendingGuess.eventId === currentEvent.id && currentVideoMs < currentEvent.eventTimeMs;

    if (isWaitingForCurrentEvent) {
      const canCancelBySameButton = canCancelPending && pendingGuess?.guessKind === guessKind;
      if (canCancelBySameButton) {
        handleCancelPending();
      }
      return;
    }

    const nowMs = Math.round(videoRef.current.currentTime * 1000);
    const effectiveNowMs = Math.max(0, nowMs - calibrationOffsetMs);
    const resolvedIndex = resolveCurrentEventIndex(nowMs, currentEventIndex, selectedGame.events, eventGraceMs);

    if (resolvedIndex !== currentEventIndex) {
      markMissedEvents(currentEventIndex, resolvedIndex);
      moveToEventIndex(resolvedIndex);
    }

    const targetEvent = selectedGame.events[resolvedIndex] ?? null;
    if (!targetEvent) return;

    if (blockedEventIds.includes(targetEvent.id)) {
      moveToEventIndex(resolvedIndex + 1);
      return;
    }

    const signedDiff = effectiveNowMs - targetEvent.eventTimeMs;
    const delta = Math.abs(signedDiff);
    const baseScore = calculateScoreForGame(mode, signedDiff);
    const calculatedScore = applyGuessKindScore(baseScore, guessKind);

    setGuessedTimeMs(effectiveNowMs);
    setEventTimeMs(targetEvent.eventTimeMs);
    setSignedDeltaMs(signedDiff);
    setScore(calculatedScore);
    setLastGuessKind(guessKind);

    const guessPayload: PendingGuess = {
      roundSeq: roundSeqRef.current,
      eventId: targetEvent.id,
      eventIndex: resolvedIndex,
      eventTimeMs: targetEvent.eventTimeMs,
      guessedTimeMs: effectiveNowMs,
      deltaMs: delta,
      signedDeltaMs: signedDiff,
      score: calculatedScore,
      guessKind,
    };

    if (signedDiff < 0) {
      setPendingGuess(guessPayload);
      setSubmitError(null);
      return;
    }

    await submitGuess(guessPayload);
  };

  const handleCancelPending = () => {
    if (!pendingGuess || !currentEvent) return;
    if (currentVideoMs >= currentEvent.eventTimeMs) return;
    if (cancelAttemptsLeft <= 0) return;

    setPendingGuess(null);
    setCancelAttemptsLeft((prev) => prev - 1);
    setGuessedTimeMs(null);
    setEventTimeMs(null);
    setSignedDeltaMs(null);
    setScore(null);
    setEventFeedback("Ожидание по событию отменено");
    setEventFeedbackType(null);
  };

  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    setCurrentEventIndex(0);
    resetRound();
    setIsRestoringProgress(true);
    setIsPlaying(false);
    if (videoRef.current) {
      suppressSeekGuardRef.current = true;
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
      videoRef.current.load();
    }
  };

  const handleChangeName = () => {
    restoreSeqRef.current += 1;
    setPracticeModeByGame({ football: false, cs2: false });
    setHasPlayedByGame({ football: false, cs2: false });
    setIsNameSet(false);
    resetRound();
  };

  const handleReplayNoRating = async () => {
    if (!canUsePracticeMode) return;

    setPracticeModeByGame((prev) => ({ ...prev, [mode]: true }));
    restoreSeqRef.current += 1;
    setCurrentEventIndex(0);
    resetRound();
    setIsRestoringProgress(false);
    setSubmitError(null);
    if (videoRef.current) {
      suppressSeekGuardRef.current = true;
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
      videoRef.current.load();

      try {
        await videoRef.current.play();
      } catch {
        setSubmitError("Не удалось автоматически запустить видео");
      }
    }
  };

  const canCancelPending =
    !!pendingGuess && !!currentEvent && pendingGuess.eventId === currentEvent.id && currentVideoMs < currentEvent.eventTimeMs && cancelAttemptsLeft > 0;
  const isWaitingForPendingEvent =
    !!pendingGuess && !!currentEvent && pendingGuess.eventId === currentEvent.id && currentVideoMs < currentEvent.eventTimeMs;
  const isGuessDisabled = currentEvent === null || hasReachedLastEvent || isRestoringProgress || !hasVideoStarted;
  const canCancelKill = canCancelPending && pendingGuess?.guessKind === "kill";
  const canCancelHeadshot = canCancelPending && pendingGuess?.guessKind === "headshot";
  const canCancelGoal = canCancelPending && pendingGuess?.guessKind === "goal";
  const isKillButtonDisabled = isGuessDisabled || (isWaitingForPendingEvent && !canCancelKill);
  const isHeadshotButtonDisabled = isGuessDisabled || (isWaitingForPendingEvent && !canCancelHeadshot);
  const isGoalButtonDisabled = isGuessDisabled || (isWaitingForPendingEvent && !canCancelGoal);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }

      if (isGuessDisabled) return;

      event.preventDefault();
      void handleGuess(mode === "cs2" ? "headshot" : "goal");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isGuessDisabled, mode, handleGuess]);

  if (isBootstrapping) {
    return <div className="flex flex-1 bg-zinc-50" />;
  }

  if (!isNameSet) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Введите имя</h2>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Ваше имя"
            className="w-full px-4 py-2 border border-zinc-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
          />

          <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-800">Калибровка задержки (опционально)</p>
            <p className="mt-1 text-xs text-zinc-600">
              3 быстрых теста реакции. Итоговая поправка: <span className="font-semibold">{formatSecondsFromMs(calibrationOffsetMs)}</span>
            </p>
            {calibrationMessage && <p className="mt-2 text-xs text-zinc-600">{calibrationMessage}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {!isCalibrating ? (
                <button
                  type="button"
                  onClick={startCalibration}
                  className="px-3 py-2 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Пройти калибровку
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCalibrationClick}
                  disabled={!isCalibrationSignalVisible}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed ${
                    isCalibrationSignalVisible ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  {isCalibrationSignalVisible
                    ? `Нажать - сигнал (${calibrationSamples.length + 1}/${CALIBRATION_SAMPLE_COUNT})`
                    : "Ждите сигнал..."}
                </button>
              )}

              {isCalibrating && (
                <button
                  type="button"
                  onClick={stopCalibration}
                  className="px-3 py-2 text-sm bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Остановить
                </button>
              )}

              {!isCalibrating && calibrationOffsetMs > 0 && (
                <button
                  type="button"
                  onClick={resetCalibration}
                  className="px-3 py-2 text-sm bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleNameSubmit}
            disabled={!playerName.trim()}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:bg-zinc-300 disabled:cursor-not-allowed"
          >
            Начать
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 p-8">
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Игра на точность тайминга - {playerName}</h1>
          <button
            onClick={handleChangeName}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            Сменить имя
          </button>
        </div>

        <div className="mb-6 flex gap-3">
          <button
            onClick={() => handleModeChange("football")}
            className={`px-4 py-2 rounded-lg border ${
              mode === "football" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-700 border-zinc-300"
            } cursor-pointer`}
          >
            ⚽ Футбол
          </button>
          <button
            onClick={() => handleModeChange("cs2")}
            className={`px-4 py-2 rounded-lg border ${
              mode === "cs2" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-700 border-zinc-300"
            } cursor-pointer`}
          >
            🎮 CS2
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="text-xl font-semibold text-zinc-900">{selectedGame.promptTitle}</h2>
              <div className="mt-2">
                <p className="text-sm text-zinc-500">Текущее время: {formatSecondsFromMs(currentVideoMs)}</p>
                {calibrationOffsetMs > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-zinc-500">Поправка к клику: -{formatSecondsFromMs(calibrationOffsetMs)}</p>
                    <button
                      type="button"
                      onClick={resetCalibration}
                      className="px-2 py-1 text-xs bg-white border border-zinc-300 text-zinc-700 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      Убрать поправку
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              {videoError ? (
                <div className="aspect-video bg-zinc-900 rounded flex flex-col items-center justify-center p-8">
                  <p className="text-white text-lg mb-4 text-center">Видеофайл не найден</p>
                  <p className="text-zinc-400 text-sm text-center">
                    Добавьте файл {selectedGame.videoSrc.replace("/", "")} в папку /public
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <video
                    key={selectedGame.videoSrc}
                    ref={videoRef}
                    className="w-full aspect-video bg-black rounded"
                    controls={canSeekFreely}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    onSeeking={handleVideoSeeking}
                    onPlay={() => {
                      setIsPlaying(true);
                      setHasVideoStarted(true);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onError={() => setVideoError(true)}
                  >
                    <source src={selectedGame.videoSrc} type="video/mp4" />
                    Ваш браузер не поддерживает тег video.
                  </video>

                  {!canSeekFreely && (
                    <button
                      onClick={handleTogglePlayback}
                      className="absolute bottom-3 left-3 h-10 min-w-10 px-3 rounded-full bg-black/70 text-white hover:bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center gap-2 cursor-pointer"
                      aria-label={isPlaying ? "Пауза" : "Пуск"}
                    >
                      {isPlaying ? (
                        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <rect x="3" y="2" width="3" height="12" rx="1" />
                          <rect x="10" y="2" width="3" height="12" rx="1" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path d="M4 2.75c0-.78.84-1.26 1.5-.85l7 4.25a1 1 0 0 1 0 1.7l-7 4.25A1 1 0 0 1 4 11.25V2.75Z" />
                        </svg>
                      )}
                      <span className="text-sm font-medium">{isPlaying ? "Пауза" : "Пуск"}</span>
                    </button>
                  )}
                </div>
              )}

              <div className="mt-3">
                {mode === "cs2" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => void handleGuess("kill")}
                      disabled={isKillButtonDisabled}
                      className="w-full px-4 py-3 bg-green-600 text-white text-base font-semibold rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:bg-zinc-400 disabled:cursor-not-allowed"
                    >
                      {currentEvent === null || hasReachedLastEvent ? "Нет событий" : canCancelKill ? "Отменить фраг" : "frag (max + 50)"}
                    </button>
                    <button
                      onClick={() => void handleGuess("headshot")}
                      disabled={isHeadshotButtonDisabled}
                      className="w-full px-4 py-3 bg-red-600 text-white text-base font-semibold rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:bg-zinc-400 disabled:cursor-not-allowed"
                    >
                      {currentEvent === null || hasReachedLastEvent ? "Нет событий" : canCancelHeadshot ? "Отменить headshot" : "headshot (max + 100)"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => void handleGuess("goal")}
                    disabled={isGoalButtonDisabled}
                    className="w-full sm:w-auto sm:px-8 px-6 py-3 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:bg-zinc-400 disabled:cursor-not-allowed"
                  >
                    {currentEvent === null || hasReachedLastEvent ? "Все события пройдены" : canCancelGoal ? "Отменить goal" : "goal (max + 100)"}
                  </button>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs text-amber-800">
                    <span>Длительность</span>
                    <span>{Math.round(replayProgressPercent)}%</span>
                  </div>
                  {canUsePracticeMode && (
                    <button
                      onClick={() => void handleReplayNoRating()}
                      className="px-3 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                      Повторить (без рейтинга)
                    </button>
                  )}
                </div>
                  <div className="mt-2 h-2 w-full rounded bg-amber-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${replayProgressPercent}%` }}
                    />
                  </div>
                  {isPracticeMode && (
                    <p className="mt-2 text-xs text-amber-800">Режим без рейтинга</p>
                  )}
                </div>
            </div>

            <div
              className="relative overflow-hidden rounded-lg border px-4 py-3"
              style={{
                borderColor: score === null ? "#d4d4d8" : score >= 35 ? "#86efac" : score >= 12 ? "#fcd34d" : "#fca5a5",
                backgroundColor: score === null ? "#fafafa" : score >= 35 ? "#f0fdf4" : score >= 12 ? "#fffbeb" : "#fef2f2",
              }}
            >
              {maxHitFxLabel && (
                <div key={maxHitFxToken} className="pointer-events-none absolute inset-x-0 top-10 bottom-0 z-10 overflow-hidden">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow max-hit-badge">
                    {maxHitFxLabel}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-zinc-600">Очки за предыдущий клик</p>
                <p className="text-xs font-medium text-zinc-500">
                  Максимум: {mode === "cs2" ? "50-100" : getMaxScoreForGuessKind(lastGuessKind)}
                </p>
              </div>
              <p
                className="text-4xl font-extrabold"
                style={{ color: score === null ? "#71717a" : score >= 35 ? "#15803d" : score >= 12 ? "#b45309" : "#dc2626" }}
              >
                {score ?? "-"}
              </p>
              {eventFeedback && (
                <p className={`mt-2 text-sm ${eventFeedbackType === "miss" ? "text-red-600" : "text-zinc-700"}`}>{eventFeedback}</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <p className="text-sm text-zinc-600">
                Повторный клик по той же кнопке отменяет выбор. Осталось отмен: {cancelAttemptsLeft}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 min-h-[360px]">
              <h2 className="text-xl font-bold text-zinc-900 mb-4">Ваш результат</h2>
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-amber-700">Суммарные очки</p>
                    <p className="text-3xl font-extrabold text-amber-900">{totalScore}</p>
                  </div>
                <div>
                  <p className="text-sm text-zinc-500">Ваше время</p>
                  <p className={`text-lg ${getScoreColorClass(score)}`}>
                    {guessedTimeMs !== null ? formatSecondsFromMs(guessedTimeMs) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Событие и отклонение</p>
                  <p className="text-lg font-semibold text-zinc-900">
                    {eventTimeMs !== null && signedDeltaMs !== null ? (
                      <>
                        {formatEventTimeMs(eventTimeMs)} | <span className={getScoreColorClass(score)}>{formatSignedDeltaMs(signedDeltaMs)}</span>
                      </>
                    ) : (
                      "-"
                    )}
                  </p>
                </div>
                <div className="min-h-[104px]">
                  <p className="text-sm text-zinc-500 mb-2">Отклонения по событиям</p>
                  <div className="space-y-2">
                    {visibleEventRows.length === 0 ? (
                      <div className="text-sm text-zinc-400">Пока нет отмеченных событий</div>
                    ) : (
                      visibleEventRows.map((item, idx) => (
                        <div
                          key={item.eventNumber}
                          className={`flex items-center justify-between text-sm text-zinc-700 py-1 ${
                            idx < visibleEventRows.length - 1 ? "border-b border-zinc-200/70" : ""
                          }`}
                        >
                          <span>{getEventDisplayLabel(mode, item.eventNumber)}</span>
                          {("isMissed" in item && item.isMissed) || !("score" in item) ? (
                            <span>пропуск (очки: 0)</span>
                          ) : (
                            <span className="text-zinc-900">
                              {formatEventTimeMs(item.eventTimeMs)} |{" "}
                              <span className={getScoreColorClass(item.score)}>{formatSignedDeltaMs(item.signedDeltaMs)}</span> (очки: <span className={getScoreColorClass(item.score)}>{item.score}</span>)
                              {item.isPersisted === false && <span className="text-red-600"> (не сохранено)</span>}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-200 min-h-[8px]" />
              </div>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{submitError}</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8 min-h-[560px]">
              <h2 className="text-xl font-bold text-zinc-900 mb-1">Таблица лидеров</h2>
              <p className="text-sm text-zinc-500 mb-4">{selectedGame.title}</p>

              {isLoadingLeaderboard ? (
                <div className="text-center py-8 text-zinc-500">Загрузка...</div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">Пока нет результатов. Будьте первым!</div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        entry.name === playerName ? "bg-amber-100 border border-amber-300" : "bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-zinc-900">
                          {getRankEmoji(entry.rank) ? `${getRankEmoji(entry.rank)} ` : ""}#{entry.rank}
                        </span>
                        <span className={`text-zinc-700 ${entry.name === playerName ? "font-bold" : ""}`}>{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600">{entry.score}</div>
                      </div>
                    </div>
                  ))}

                  {playerRow && !leaderboard.some((entry) => entry.name === playerRow.name) && (
                    <>
                      {bridgeRow && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg text-zinc-900">
                              {getRankEmoji(bridgeRow.rank) ? `${getRankEmoji(bridgeRow.rank)} ` : ""}#{bridgeRow.rank}
                            </span>
                            <span className="text-zinc-700">{bridgeRow.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-blue-600">{bridgeRow.score}</div>
                          </div>
                        </div>
                      )}
                      {!bridgeRow && leaderboard.length > 0 && playerRow.rank > leaderboard[leaderboard.length - 1].rank + 1 && (
                        <div className="text-center text-zinc-400">...</div>
                      )}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-100 border border-amber-300">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg text-zinc-900">
                            {getRankEmoji(playerRow.rank) ? `${getRankEmoji(playerRow.rank)} ` : ""}#{playerRow.rank}
                          </span>
                          <span className="text-zinc-700 font-bold">{playerRow.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600">{playerRow.score}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
