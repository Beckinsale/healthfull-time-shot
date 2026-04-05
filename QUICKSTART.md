# Quick Start Guide

Get the Event Timing Game running in 5 minutes.

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Setup Supabase

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to SQL Editor
4. Copy and run contents of `supabase-schema.sql`

## 3. Configure Environment

1. Copy `.env.example` to `.env.local`
2. Add your Supabase credentials:
   - Get URL from Project Settings > API
   - Get anon key from Project Settings > API

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

## 4. Add Demo Video

Place a video file named `demo.mp4` in `/public` directory.

The event is configured for 14500ms (14.5 seconds).

## 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## 6. Test the Flow

1. Enter your name
2. Watch video
3. Click "Guess Now!" at 14.5 seconds
4. See your score
5. Check leaderboard

## Common Issues

**Video not loading?**
- Ensure file is named exactly `demo.mp4`
- Check file is in `/public` directory

**Can't save score?**
- Verify `.env.local` has correct Supabase credentials
- Check Supabase dashboard > SQL Editor for tables

**Build errors?**
- Delete `.next` and `node_modules`
- Run `pnpm install` again

## Next Steps

- See `README.md` for full documentation
- See `DEPLOYMENT.md` for deployment guide
- See `SUPABASE_SETUP.md` for database details

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Or connect via GitHub and deploy from dashboard
```

Remember to add environment variables in Vercel dashboard!
