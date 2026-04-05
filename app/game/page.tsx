"use client";

import { useState, useRef, useEffect } from "react";

const EVENT_TIME_MS = 10000; // 10 seconds - adjusted for demo video

function calculateScore(deltaMs: number): number {
  if (deltaMs <= 300) return 100;
  if (deltaMs <= 1000) return 70;
  if (deltaMs <= 2000) return 40;
  if (deltaMs <= 5000) return 10;
  return 0;
}

export default function GamePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerName, setPlayerName] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [guessedTimeMs, setGuessedTimeMs] = useState<number | null>(null);
  const [deltaMs, setDeltaMs] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{
    rank: number;
    name: string;
    score: number;
    delta: number;
  }>>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      setIsLoadingLeaderboard(true);
      const response = await fetch('/api/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const checkExistingSubmission = async (name: string) => {
    try {
      const response = await fetch(`/api/check-submission?player_name=${encodeURIComponent(name)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.has_submitted && data.submission) {
          setGuessedTimeMs(data.submission.guessed_time_ms);
          setDeltaMs(data.submission.delta_ms);
          setScore(data.submission.score);
          setHasGuessed(true);
          localStorage.setItem('hasSubmitted', 'true');
        }
      }
    } catch (error) {
      console.error('Failed to check submission:', error);
    }
  };

  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) {
      setPlayerName(savedName);
      setIsNameSet(true);
      checkExistingSubmission(savedName);
    }

    fetchLeaderboard();
  }, []);

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      setIsNameSet(true);
      localStorage.setItem("playerName", playerName);
    }
  };

  const handleGuess = async () => {
    if (videoRef.current && !isSubmitting) {
      setIsSubmitting(true);
      setSubmitError(null);

      const currentTimeSeconds = videoRef.current.currentTime;
      const timeMs = Math.round(currentTimeSeconds * 1000);
      const delta = Math.abs(timeMs - EVENT_TIME_MS);
      const calculatedScore = calculateScore(delta);

      // Set local state immediately for instant feedback
      setGuessedTimeMs(timeMs);
      setDeltaMs(delta);
      setScore(calculatedScore);
      setHasGuessed(true);

      // Save to localStorage
      localStorage.setItem('hasSubmitted', 'true');

      // Submit to API
      try {
        const response = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_name: playerName,
            guessed_time_ms: timeMs,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 409) {
            setSubmitError('You have already submitted for this event');
          } else {
            setSubmitError(data.error || 'Failed to save submission');
          }
        } else {
          // Refresh leaderboard after successful submission
          fetchLeaderboard();
        }
      } catch (error) {
        console.error('Submit error:', error);
        setSubmitError('Network error. Your score was calculated but not saved.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (!isNameSet) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Enter Your Name</h2>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2 border border-zinc-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
          />
          <button
            onClick={handleNameSubmit}
            disabled={!playerName.trim()}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-zinc-300 disabled:cursor-not-allowed"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  const handleChangeName = () => {
    setIsNameSet(false);
    setHasGuessed(false);
    setGuessedTimeMs(null);
    setDeltaMs(null);
    setScore(null);
    setSubmitError(null);
    localStorage.removeItem('hasSubmitted');
  };

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 p-8">
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">
            Event Timing Game - {playerName}
          </h1>
          <button
            onClick={handleChangeName}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Change Name
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main game area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video player */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              {videoError ? (
                <div className="aspect-video bg-zinc-900 rounded flex flex-col items-center justify-center p-8">
                  <p className="text-white text-lg mb-4 text-center">
                    Video file not found
                  </p>
                  <p className="text-zinc-400 text-sm text-center">
                    Please add demo.mp4 to the /public directory
                  </p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  className="w-full aspect-video bg-black rounded"
                  controls
                  onError={() => setVideoError(true)}
                >
                  <source src="/demo.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>

            {/* Guess button */}
            <div className="flex justify-center">
              <button
                onClick={handleGuess}
                disabled={hasGuessed || isSubmitting}
                className="px-8 py-4 bg-green-600 text-white text-xl font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting..." : hasGuessed ? "Already Guessed" : "Guess Now!"}
              </button>
            </div>

            {/* Result display */}
            {hasGuessed && guessedTimeMs !== null && deltaMs !== null && score !== null && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-zinc-900 mb-4">Your Result</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-zinc-500">Event Time</p>
                    <p className="text-lg text-zinc-900">
                      {(EVENT_TIME_MS / 1000).toFixed(2)}s ({EVENT_TIME_MS}ms)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Your Guess</p>
                    <p className="text-lg text-zinc-900">
                      {(guessedTimeMs / 1000).toFixed(2)}s ({guessedTimeMs}ms)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Delta</p>
                    <p className="text-lg font-semibold text-zinc-900">{deltaMs}ms</p>
                  </div>
                  <div className="pt-2 border-t border-zinc-200">
                    <p className="text-3xl font-bold" style={{
                      color: score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444'
                    }}>
                      Score: {score}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{submitError}</p>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-zinc-900 mb-4">Leaderboard</h2>
              {isLoadingLeaderboard ? (
                <div className="text-center py-8 text-zinc-500">Loading...</div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No submissions yet. Be the first!
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-zinc-900">
                          #{entry.rank}
                        </span>
                        <span className="text-zinc-700">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600">{entry.score}</div>
                        <div className="text-xs text-zinc-500">{entry.delta}ms</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
