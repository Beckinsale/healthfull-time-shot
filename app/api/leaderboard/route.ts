import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000002';

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('event_id') || DEFAULT_EVENT_ID;

    const { data, error } = await supabase
      .from('submissions')
      .select('player_name, score, delta_ms, created_at')
      .eq('event_id', eventId)
      .order('score', { ascending: false })
      .order('delta_ms', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Не удалось загрузить таблицу лидеров' },
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
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
