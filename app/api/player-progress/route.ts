import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

const GAME_ID_BY_MODE = {
  football: '00000000-0000-0000-0000-000000000001',
  cs2: '00000000-0000-0000-0000-000000000010',
} as const;

type GameMode = keyof typeof GAME_ID_BY_MODE;

function isSupabaseNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return message.includes('fetch failed') || message.includes('Connect Timeout Error');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ submissions: [], unavailable: true }, { status: 503 });
    }

    const playerName = request.nextUrl.searchParams.get('player_name');
    const modeParam = request.nextUrl.searchParams.get('mode');
    const mode: GameMode = modeParam === 'cs2' ? 'cs2' : 'football';
    const gameId = GAME_ID_BY_MODE[mode];

    if (!playerName) {
      return NextResponse.json({ error: 'Отсутствует параметр player_name' }, { status: 400 });
    }

    const signal = AbortSignal.timeout(4000);
    const { data, error } = await supabase
      .from('submissions')
      .select('event_id, guessed_time_ms, delta_ms, score, created_at')
      .eq('player_name', playerName)
      .eq('game_id', gameId)
      .abortSignal(signal)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);

      if (isSupabaseNetworkError(error)) {
        return NextResponse.json({ submissions: [], unavailable: true });
      }

      return NextResponse.json({ error: 'Не удалось загрузить прогресс игрока' }, { status: 500 });
    }

    return NextResponse.json({ submissions: data ?? [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
