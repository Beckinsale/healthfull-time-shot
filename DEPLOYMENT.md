# Deployment Guide

## Pre-Deployment Checklist

### 1. Database Setup

- [ ] Create Supabase project
- [ ] Run `supabase-schema.sql` in SQL Editor
- [ ] Verify tables created: `games`, `events`, `submissions`
- [ ] Verify demo game and event are seeded
- [ ] Note down Project URL and anon key

### 2. Video File

- [ ] Add `demo.mp4` to `/public` directory
- [ ] Verify video plays locally
- [ ] Event time is at 14500ms (14.5 seconds)

### 3. Environment Variables

- [ ] Copy `.env.example` to `.env.local`
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Test locally with `pnpm dev`

### 4. Code Quality

- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run linter: `pnpm lint`
- [ ] Test build: `pnpm build`

### 5. Functional Testing

- [ ] Video loads and plays
- [ ] Name input saves to localStorage
- [ ] Guess button captures time correctly
- [ ] Score calculation works
- [ ] Submission saves to Supabase
- [ ] Leaderboard displays and updates
- [ ] Duplicate submission blocked (409 error)
- [ ] Change Name button works

## Deployment to Vercel

### Method 1: GitHub Integration (Recommended)

1. Push code to GitHub:
```bash
git remote add origin <your-repo-url>
git push -u origin master
```

2. Go to [vercel.com](https://vercel.com)

3. Click "New Project"

4. Import your GitHub repository

5. Configure project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `pnpm build` (or leave default)
   - Output Directory: `.next` (or leave default)

6. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your_supabase_url
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your_supabase_key

7. Click "Deploy"

8. Wait for deployment to complete

9. Test the deployed app

### Method 2: Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Follow prompts and add environment variables

5. Deploy to production:
```bash
vercel --prod
```

## Post-Deployment

### Verify Functionality

- [ ] Open deployed URL
- [ ] Test full game flow
- [ ] Check Supabase dashboard for submissions
- [ ] Verify leaderboard updates
- [ ] Test from multiple devices/browsers
- [ ] Check console for errors

### Configure Custom Domain (Optional)

1. Go to Project Settings in Vercel
2. Add custom domain
3. Update DNS records as instructed

## Troubleshooting

### Video not loading
- Ensure `demo.mp4` is committed to git
- Check public directory structure
- Verify video file size (< 50MB recommended)

### Supabase connection fails
- Verify environment variables are set in Vercel
- Check Supabase project is active
- Verify API keys are correct
- Check CORS settings in Supabase

### Build fails
- Run `pnpm build` locally first
- Check for TypeScript errors
- Verify all dependencies are in package.json

### 409 errors not working
- Verify unique constraint in Supabase
- Check submissions table schema
- Test duplicate submission manually

## Environment Variables Reference

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Support

For issues:
1. Check browser console for errors
2. Check Vercel deployment logs
3. Check Supabase logs in dashboard
4. Verify environment variables

## Production Checklist

- [ ] All environment variables set
- [ ] Video file added
- [ ] Database seeded
- [ ] App tested in production
- [ ] Custom domain configured (if applicable)
- [ ] Analytics added (if desired)

## Notes

- This is an MVP - no authentication or authorization
- Demo game/event IDs are hardcoded
- One submission per player name per event
- localStorage used for client-side state
