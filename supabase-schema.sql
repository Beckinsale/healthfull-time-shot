-- Event Timing Game Database Schema

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_time_ms INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  guessed_time_ms INTEGER NOT NULL,
  delta_ms INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_name, event_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_submissions_game_id ON submissions(game_id);
CREATE INDEX IF NOT EXISTS idx_submissions_event_id ON submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_submissions_score ON submissions(score DESC, delta_ms ASC);

-- Seed demo game and event
INSERT INTO games (id, title, video_url) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Game', '/demo.mp4')
ON CONFLICT DO NOTHING;

INSERT INTO games (id, title, video_url)
VALUES ('00000000-0000-0000-0000-000000000010', 'CS2 Demo', '/demo2.mp4')
ON CONFLICT DO NOTHING;

INSERT INTO events (id, game_id, event_time_ms, label) 
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 3000, 'Goal')
ON CONFLICT DO NOTHING;

INSERT INTO events (id, game_id, event_time_ms, label)
VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000010', 900, 'Headshot 1')
ON CONFLICT DO NOTHING;

INSERT INTO events (id, game_id, event_time_ms, label)
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010', 3600, 'Headshot 2')
ON CONFLICT DO NOTHING;

INSERT INTO events (id, game_id, event_time_ms, label)
VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000010', 7000, 'Headshot 3')
ON CONFLICT DO NOTHING;
