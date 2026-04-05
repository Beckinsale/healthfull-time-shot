# Event Timing Game

A web-based MVP game where players watch a video and click a button to predict when an event occurs. The system calculates accuracy and maintains a leaderboard.

## Features

- Video playback with HTML5 player
- Real-time event timing capture
- Scoring system based on accuracy (±300ms = 100 points)
- Persistent leaderboard with Supabase
- Duplicate submission prevention
- Responsive design

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ or compatible runtime
- pnpm (or npm/yarn)
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Set up Supabase:
   - Follow instructions in `SUPABASE_SETUP.md`
   - Create `.env.local` with your Supabase credentials

4. Add demo video:
   - Place `demo.mp4` in `/public` directory
   - The demo event is set at 14500ms (14.5 seconds)

5. Run development server:

```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Game Rules

Players guess when an event occurs in the video. Scoring:

- ≤ 300ms difference: **100 points**
- ≤ 1000ms difference: **70 points**
- ≤ 2000ms difference: **40 points**
- ≤ 5000ms difference: **10 points**
- \> 5000ms difference: **0 points**

Each player can submit once per event.

## Project Structure

```
/app
  /api
    /submissions      # POST endpoint for submissions
    /leaderboard      # GET endpoint for leaderboard
    /check-submission # GET endpoint to check existing submission
  /game               # Game page
  layout.tsx          # Root layout
  page.tsx            # Home page
/lib
  supabase.ts         # Supabase client
/public
  demo.mp4            # Demo video (add manually)
supabase-schema.sql   # Database schema
```

## Environment Variables

See `.env.example` for required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Deployment

Deploy to Vercel:

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## MVP Scope

This is an MVP focused on core functionality:
- Simple, single-game setup
- No authentication system
- No admin panel
- Hardcoded demo game/event IDs

## License

MIT
