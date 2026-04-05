import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEMO_EVENT_ID = '00000000-0000-0000-0000-000000000002';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('player_name, score, delta_ms, created_at')
      .eq('event_id', DEMO_EVENT_ID)
      .order('score', { ascending: false })
      .order('delta_ms', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      );
    }

    const leaderboard = data.map((entry, index) => ({
      rank: index + 1,
      name: entry.player_name,
      score: entry.score,
      delta: entry.delta_ms,
    }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
