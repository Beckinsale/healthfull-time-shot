import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000002';

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('event_id') || DEFAULT_EVENT_ID;
    const playerName = request.nextUrl.searchParams.get('player_name');

    const { data, error } = await supabase
      .from('submissions')
      .select('player_name, score, delta_ms, created_at')
      .eq('event_id', eventId)
      .order('score', { ascending: false })
      .order('delta_ms', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Не удалось загрузить таблицу лидеров' },
        { status: 500 }
      );
    }

    const ranked = data.map((entry, index) => ({
      rank: index + 1,
      name: entry.player_name,
      score: entry.score,
      delta: entry.delta_ms,
    }));

    const leaderboard = ranked.slice(0, 5);
    const playerRow = playerName ? ranked.find((entry) => entry.name === playerName) ?? null : null;

    return NextResponse.json({ leaderboard, player_row: playerRow, total: ranked.length });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
