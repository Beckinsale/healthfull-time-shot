"use client";

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

type ResultEntry = {
  eventId: string;
  eventNumber: number;
  guessedTimeMs: number;
  deltaMs: number;
  score: number;
};

type PendingGuess = {
  eventId: string;
  eventIndex: number;
  guessedTimeMs: number;
  deltaMs: number;
  score: number;
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
    events: [{ id: "00000000-0000-0000-0000-000000000002", eventTimeMs: 3000 }],
  },
  cs2: {
    title: "CS2",
    videoSrc: "/demo2.mp4",
    promptTitle: "Угадайте момент наступления хэдшота",
    events: [
      { id: "00000000-0000-0000-0000-000000000003", eventTimeMs: 870 },
      { id: "00000000-0000-0000-0000-000000000004", eventTimeMs: 3740 },
      { id: "00000000-0000-0000-0000-000000000005", eventTimeMs: 7580 },
    ],
  },
};

function getEventDisplayLabel(mode: GameMode, eventNumber: number): string {
  if (mode === "football") {
    return `Событие ${eventNumber} гол`;
  }

  return `Событие ${eventNumber} headshot`;
}

function resolveCurrentEventIndex(
  timeMs: number,
  startIndex: number,
  events: EventConfig[],
  submittedEventIds: string[],
  eventGraceMs: number
): number {
  let nextIndex = startIndex;

  while (
    nextIndex < events.length &&
    (submittedEventIds.includes(events[nextIndex].id) || timeMs > events[nextIndex].eventTimeMs + eventGraceMs)
  ) {
    nextIndex += 1;
  }

  return nextIndex;
}

export default function GamePage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [mode, setMode] = useState<GameMode>("football");
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  const [playerName, setPlayerName] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);
  const [submittedEventIds, setSubmittedEventIds] = useState<string[]>([]);

  const [guessedTimeMs, setGuessedTimeMs] = useState<number | null>(null);
  const [deltaMs, setDeltaMs] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [resultHistory, setResultHistory] = useState<ResultEntry[]>([]);

  const [pendingGuess, setPendingGuess] = useState<PendingGuess | null>(null);
  const [cancelAttemptsLeft, setCancelAttemptsLeft] = useState(1);
  const [currentVideoMs, setCurrentVideoMs] = useState(0);
  const [triggeredCueIds, setTriggeredCueIds] = useState<string[]>([]);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);

  const [videoError, setVideoError] = useState(false);
  const [inFlightEventIds, setInFlightEventIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<Array<{ rank: number; name: string; score: number; delta: number }>>([]);
  const [playerRow, setPlayerRow] = useState<{ rank: number; name: string; score: number; delta: number } | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  const selectedGame = useMemo(() => GAMES[mode], [mode]);
  const currentEvent = selectedGame.events[currentEventIndex] ?? null;
  const eventGraceMs = EVENT_GRACE_MS_BY_GAME[mode];
  const blockedEventIds = useMemo(() => {
    const ids = [...submittedEventIds, ...inFlightEventIds];
    if (pendingGuess) ids.push(pendingGuess.eventId);
    return [...new Set(ids)];
  }, [submittedEventIds, inFlightEventIds, pendingGuess]);

  const moveToEventIndex = (index: number) => {
    setCurrentEventIndex(index);
    setPendingGuess(null);
    setCancelAttemptsLeft(1);
  };

  const resetRound = () => {
    setSubmittedEventIds([]);
    setGuessedTimeMs(null);
    setDeltaMs(null);
    setScore(null);
    setTotalScore(0);
    setResultHistory([]);
    setPendingGuess(null);
    setCancelAttemptsLeft(1);
    setTriggeredCueIds([]);
    setActiveCueText(null);
    setSubmitError(null);
    setCurrentVideoMs(0);
  };

  const fetchLeaderboard = async (eventId: string) => {
    try {
      setIsLoadingLeaderboard(true);
      const query = new URLSearchParams({ event_id: eventId });
      if (playerName) {
        query.set("player_name", playerName);
      }

      const response = await fetch(`/api/leaderboard?${query.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
        setPlayerRow(data.player_row || null);
      }
    } catch (error) {
      console.error("Не удалось загрузить таблицу лидеров:", error);
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

  const restoreProgress = async (name: string, gameMode: GameMode) => {
    const events = GAMES[gameMode].events;
    const restoredHistory: ResultEntry[] = [];
    let accumulatedScore = 0;

    for (let i = 0; i < events.length; i += 1) {
      const submission = await getSubmission(name, events[i].id);
      if (!submission) {
        setTotalScore(accumulatedScore);
        setResultHistory(restoredHistory);
        setSubmittedEventIds(restoredHistory.map((item) => item.eventId));
        moveToEventIndex(i);
        setSubmitError(null);

        if (restoredHistory.length > 0) {
          const last = restoredHistory[restoredHistory.length - 1];
          setGuessedTimeMs(last.guessedTimeMs);
          setDeltaMs(last.deltaMs);
          setScore(last.score);
        } else {
          setGuessedTimeMs(null);
          setDeltaMs(null);
          setScore(null);
        }
        return;
      }

      accumulatedScore += submission.score;
      restoredHistory.push({
        eventId: events[i].id,
        eventNumber: i + 1,
        guessedTimeMs: submission.guessed_time_ms,
        deltaMs: submission.delta_ms,
        score: submission.score,
      });
    }

    setTotalScore(accumulatedScore);
    setResultHistory(restoredHistory);
    setSubmittedEventIds(restoredHistory.map((item) => item.eventId));
    moveToEventIndex(events.length);
    setSubmitError(null);

    if (restoredHistory.length > 0) {
      const last = restoredHistory[restoredHistory.length - 1];
      setGuessedTimeMs(last.guessedTimeMs);
      setDeltaMs(last.deltaMs);
      setScore(last.score);
    }
  };

  const submitGuess = async (guess: PendingGuess) => {
    setPendingGuess((prev) => (prev && prev.eventId === guess.eventId ? null : prev));
    setInFlightEventIds((prev) => (prev.includes(guess.eventId) ? prev : [...prev, guess.eventId]));
    setSubmitError(null);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_name: playerName,
          guessed_time_ms: guess.guessedTimeMs,
          event_id: guess.eventId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409) {
          setSubmittedEventIds((prev) => (prev.includes(guess.eventId) ? prev : [...prev, guess.eventId]));
          moveToEventIndex(guess.eventIndex + 1);
        } else {
          setSubmitError(data.error || "Не удалось сохранить результат");
        }
      } else {
        setSubmittedEventIds((prev) => (prev.includes(guess.eventId) ? prev : [...prev, guess.eventId]));
        setTotalScore((prev) => prev + guess.score);
        setResultHistory((prev) => {
          const next = prev.filter((item) => item.eventId !== guess.eventId);
          next.push({
            eventId: guess.eventId,
            eventNumber: guess.eventIndex + 1,
            guessedTimeMs: guess.guessedTimeMs,
            deltaMs: guess.deltaMs,
            score: guess.score,
          });
          return next.sort((a, b) => a.eventNumber - b.eventNumber);
        });
        moveToEventIndex(guess.eventIndex + 1);
        fetchLeaderboard(guess.eventId);
      }
    } catch (error) {
      console.error("Ошибка отправки:", error);
      setSubmitError("Ошибка сети. Очки рассчитаны, но результат не сохранен.");
    } finally {
      setInFlightEventIds((prev) => prev.filter((id) => id !== guess.eventId));
    }
  };

  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) {
      setPlayerName(savedName);
      setIsNameSet(true);
    }
  }, []);

  useEffect(() => {
    if (isNameSet && playerName) {
      restoreProgress(playerName, mode);
    }
    setVideoError(false);
  }, [isNameSet, playerName, mode]);

  useEffect(() => {
    if (currentEvent) {
      fetchLeaderboard(currentEvent.id);
    } else {
      setLeaderboard([]);
      setPlayerRow(null);
      setIsLoadingLeaderboard(false);
    }
  }, [currentEvent?.id, playerName]);

  useEffect(() => {
    if (!videoRef.current) return;

    const timer = window.setInterval(() => {
      if (!videoRef.current) return;

      const nowMs = Math.round(videoRef.current.currentTime * 1000);
      setCurrentVideoMs(nowMs);

      const lastEvent = selectedGame.events[selectedGame.events.length - 1];
      if (lastEvent && nowMs >= lastEvent.eventTimeMs && !pendingGuess) {
        moveToEventIndex(selectedGame.events.length);
        return;
      }

      selectedGame.events.forEach((event, idx) => {
        if (!triggeredCueIds.includes(event.id) && nowMs >= event.eventTimeMs) {
          setTriggeredCueIds((prev) => [...prev, event.id]);
          setActiveCueText(`${getEventDisplayLabel(mode, idx + 1)} наступило`);
          window.setTimeout(() => {
            setActiveCueText((prev) => (prev?.startsWith(`Событие ${idx + 1}`) ? null : prev));
          }, 1200);
        }
      });

      if (!currentEvent) return;
      if (pendingGuess && pendingGuess.eventId === currentEvent.id) return;

      const nextIndex = resolveCurrentEventIndex(nowMs, currentEventIndex, selectedGame.events, blockedEventIds, eventGraceMs);
      if (nextIndex !== currentEventIndex) {
        moveToEventIndex(nextIndex);
      }
    }, 120);

    return () => window.clearInterval(timer);
  }, [currentEvent, currentEventIndex, blockedEventIds, selectedGame.events, eventGraceMs, triggeredCueIds, mode]);

  useEffect(() => {
    if (!pendingGuess || !currentEvent) return;
    if (pendingGuess.eventId !== currentEvent.id) return;
    if (currentVideoMs < currentEvent.eventTimeMs) return;

    submitGuess(pendingGuess);
  }, [pendingGuess, currentEvent, currentVideoMs]);

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      const normalizedName = playerName.trim();
      setIsNameSet(true);
      setPlayerName(normalizedName);
      localStorage.setItem("playerName", normalizedName);
    }
  };

  const handleGuess = async () => {
    if (!videoRef.current || !currentEvent) return;

    const nowMs = Math.round(videoRef.current.currentTime * 1000);
    const resolvedIndex = resolveCurrentEventIndex(nowMs, currentEventIndex, selectedGame.events, blockedEventIds, eventGraceMs);

    if (resolvedIndex !== currentEventIndex) {
      moveToEventIndex(resolvedIndex);
    }

    const targetEvent = selectedGame.events[resolvedIndex] ?? null;
    if (!targetEvent) return;

    if (blockedEventIds.includes(targetEvent.id)) {
      moveToEventIndex(resolvedIndex + 1);
      return;
    }

    const signedDiff = nowMs - targetEvent.eventTimeMs;
    const delta = Math.abs(signedDiff);
    const calculatedScore = calculateScoreForGame(mode, signedDiff);

    setGuessedTimeMs(nowMs);
    setDeltaMs(delta);
    setScore(calculatedScore);

    const guessPayload: PendingGuess = {
      eventId: targetEvent.id,
      eventIndex: resolvedIndex,
      guessedTimeMs: nowMs,
      deltaMs: delta,
      score: calculatedScore,
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
    setDeltaMs(null);
    setScore(null);
  };

  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    setCurrentEventIndex(0);
    resetRound();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
      videoRef.current.load();
    }
  };

  const handleChangeName = () => {
    setIsNameSet(false);
    resetRound();
  };

  const canCancelPending =
    !!pendingGuess && !!currentEvent && pendingGuess.eventId === currentEvent.id && currentVideoMs < currentEvent.eventTimeMs && cancelAttemptsLeft > 0;

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
            Футбол
          </button>
          <button
            onClick={() => handleModeChange("cs2")}
            className={`px-4 py-2 rounded-lg border ${
              mode === "cs2" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-700 border-zinc-300"
            } cursor-pointer`}
          >
            CS2
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="text-xl font-semibold text-zinc-900">{selectedGame.promptTitle}</h2>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-zinc-500">Текущее время: {(currentVideoMs / 1000).toFixed(2)}s</p>
                <span className={`text-sm font-semibold px-3 py-1 rounded ${activeCueText ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
                  {activeCueText ?? "Ожидание события..."}
                </span>
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
                <video
                  key={selectedGame.videoSrc}
                  ref={videoRef}
                  className="w-full aspect-video bg-black rounded"
                  controls
                  onError={() => setVideoError(true)}
                >
                  <source src={selectedGame.videoSrc} type="video/mp4" />
                  Ваш браузер не поддерживает тег video.
                </video>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <p className="text-sm text-zinc-600">
                Можно отменить, осталось попыток для отмены: {cancelAttemptsLeft}
              </p>
              <div className="mt-3 h-10">
                <button
                  onClick={handleCancelPending}
                  disabled={!canCancelPending}
                  className={`px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed ${
                    canCancelPending ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  Отменить последний клик
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleGuess}
                disabled={currentEvent === null}
                className="px-8 py-4 bg-green-600 text-white text-xl font-semibold rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:bg-zinc-400 disabled:cursor-not-allowed"
              >
                {currentEvent === null ? "Все события пройдены" : pendingGuess ? "Ожидание события..." : "Угадать"}
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 min-h-[360px]">
              <h2 className="text-xl font-bold text-zinc-900 mb-4">Ваш результат</h2>
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-amber-700">Суммарные очки</p>
                    <p className="text-3xl font-extrabold text-amber-900">{totalScore}</p>
                  </div>
                  <div className="rounded-lg border px-4 py-3" style={{
                    borderColor: score === null ? "#d4d4d8" : score >= 35 ? "#86efac" : score >= 12 ? "#fcd34d" : "#fca5a5",
                    backgroundColor: score === null ? "#fafafa" : score >= 35 ? "#f0fdf4" : score >= 12 ? "#fffbeb" : "#fef2f2",
                  }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-zinc-600">Очки за клик</p>
                      <p className="text-xs font-medium text-zinc-500">Максимум: 100</p>
                    </div>
                    <p
                      className="text-4xl font-extrabold"
                      style={{
                        color:
                          score === null ? "#71717a" : score >= 35 ? "#15803d" : score >= 12 ? "#b45309" : "#dc2626",
                      }}
                    >
                      {score ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Ваше время</p>
                    <p className="text-lg text-zinc-900">
                      {guessedTimeMs !== null ? `${(guessedTimeMs / 1000).toFixed(2)}s (${guessedTimeMs}ms)` : "-"}
                    </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Отклонение</p>
                  <p className="text-lg font-semibold text-zinc-900">{deltaMs !== null ? `${deltaMs}ms` : "-"}</p>
                </div>
                <div className="min-h-[104px]">
                  <p className="text-sm text-zinc-500 mb-2">Отклонения по событиям</p>
                  <div className="space-y-2">
                    {resultHistory.length > 0
                      ? resultHistory.map((item) => (
                          <div key={item.eventId} className="flex items-center justify-between text-sm text-zinc-700">
                            <span>{getEventDisplayLabel(mode, item.eventNumber)}</span>
                            <span>{item.deltaMs}ms (очки: {item.score})</span>
                          </div>
                        ))
                      : Array.from({ length: selectedGame.events.length }).map((_, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm text-zinc-400">
                            <span>{getEventDisplayLabel(mode, idx + 1)}</span>
                            <span>-</span>
                          </div>
                        ))}
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
                        <span className="font-bold text-lg text-zinc-900">#{entry.rank}</span>
                        <span className={`text-zinc-700 ${entry.name === playerName ? "font-bold" : ""}`}>{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600">{entry.score}</div>
                        <div className="text-xs text-zinc-500">{entry.delta}ms</div>
                      </div>
                    </div>
                  ))}

                  {playerRow && !leaderboard.some((entry) => entry.name === playerRow.name) && (
                    <>
                      {leaderboard.length > 0 && playerRow.rank > leaderboard[leaderboard.length - 1].rank + 1 && (
                        <div className="text-center text-zinc-400">...</div>
                      )}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-100 border border-amber-300">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg text-zinc-900">#{playerRow.rank}</span>
                          <span className="text-zinc-700 font-bold">{playerRow.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600">{playerRow.score}</div>
                          <div className="text-xs text-zinc-500">{playerRow.delta}ms</div>
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
