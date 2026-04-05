# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Create a new project
4. Wait for the project to be provisioned

## 2. Run Database Schema

1. Go to SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase-schema.sql`
3. Paste and run the SQL script
4. Verify that tables `games`, `events`, and `submissions` are created
5. Verify that demo game and event are seeded

## 3. Configure Environment Variables

1. Go to Project Settings > API in your Supabase dashboard
2. Copy the `Project URL`
3. Copy the `anon/public` key
4. Create `.env.local` in the project root (if not exists)
5. Add the following:

```
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 4. Restart Development Server

```bash
pnpm dev
```

## 5. Test

1. Open the app
2. Enter your name
3. Play the video and click "Guess Now!"
4. Verify submission is saved in Supabase dashboard

## Troubleshooting

If submissions are not saving:
- Check browser console for errors
- Verify environment variables are set correctly
- Check Supabase dashboard SQL Editor for table structure
- Ensure RLS (Row Level Security) is disabled or configured correctly
