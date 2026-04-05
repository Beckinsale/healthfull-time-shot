"use client";

import { useState, useRef, useEffect } from "react";

export default function GamePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerName, setPlayerName] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [guessedTimeMs, setGuessedTimeMs] = useState<number | null>(null);
  const [videoError, setVideoError] = useState(false);

  const mockLeaderboard = [
    { rank: 1, name: "Player1", score: 100, delta: 150 },
    { rank: 2, name: "Player2", score: 70, delta: 800 },
    { rank: 3, name: "Player3", score: 40, delta: 1500 },
  ];

  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) {
      setPlayerName(savedName);
      setIsNameSet(true);
    }
  }, []);

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      setIsNameSet(true);
      localStorage.setItem("playerName", playerName);
    }
  };

  const handleGuess = () => {
    if (videoRef.current) {
      const currentTimeSeconds = videoRef.current.currentTime;
      const timeMs = Math.round(currentTimeSeconds * 1000);
      setGuessedTimeMs(timeMs);
      setHasGuessed(true);
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

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 p-8">
      <div className="w-full max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 mb-8">
          Event Timing Game - {playerName}
        </h1>

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
                disabled={hasGuessed}
                className="px-8 py-4 bg-green-600 text-white text-xl font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed"
              >
                {hasGuessed ? "Already Guessed" : "Guess Now!"}
              </button>
            </div>

            {/* Result display */}
            {hasGuessed && guessedTimeMs !== null && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-zinc-900 mb-4">Your Result</h2>
                <div className="space-y-2">
                  <p className="text-zinc-700">
                    <span className="font-semibold">Guessed Time:</span>{" "}
                    {(guessedTimeMs / 1000).toFixed(2)}s ({guessedTimeMs}ms)
                  </p>
                  <p className="text-zinc-700">
                    <span className="font-semibold">Delta:</span> (will calculate in Phase 4)
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    Score: (will calculate in Phase 4)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-zinc-900 mb-4">Leaderboard</h2>
              <div className="space-y-3">
                {mockLeaderboard.map((entry) => (
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
