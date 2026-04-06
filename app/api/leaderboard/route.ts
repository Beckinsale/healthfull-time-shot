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
      return NextResponse.json({ leaderboard: [], player_row: null, total: 0, unavailable: true }, { status: 503 });
    }

    const modeParam = request.nextUrl.searchParams.get('mode');
    const mode: GameMode = modeParam === 'cs2' ? 'cs2' : 'football';
    const gameId = GAME_ID_BY_MODE[mode];
    const playerName = request.nextUrl.searchParams.get('player_name');

    const signal = AbortSignal.timeout(4000);

    const { data, error } = await supabase
      .from('submissions')
      .select('player_name, score, delta_ms, created_at')
      .eq('game_id', gameId)
      .abortSignal(signal)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);

      if (isSupabaseNetworkError(error)) {
        return NextResponse.json({ leaderboard: [], player_row: null, total: 0, unavailable: true });
      }

      return NextResponse.json(
        { error: 'Не удалось загрузить таблицу лидеров' },
        { status: 500 }
      );
    }

    const grouped = new Map<
      string,
      { name: string; score: number; totalDelta: number; attempts: number; firstCreatedAt: string }
    >();

    for (const entry of data) {
      const existing = grouped.get(entry.player_name);
      if (existing) {
        existing.score += entry.score;
        existing.totalDelta += entry.delta_ms;
        existing.attempts += 1;
        continue;
      }

      grouped.set(entry.player_name, {
        name: entry.player_name,
        score: entry.score,
        totalDelta: entry.delta_ms,
        attempts: 1,
        firstCreatedAt: entry.created_at,
      });
    }

    const ranked = [...grouped.values()]
      .map((entry) => ({
        name: entry.name,
        score: entry.score,
        delta: Math.round(entry.totalDelta / entry.attempts),
        firstCreatedAt: entry.firstCreatedAt,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.delta !== b.delta) return a.delta - b.delta;
        return a.firstCreatedAt.localeCompare(b.firstCreatedAt);
      })
      .map((entry, index) => ({
        rank: index + 1,
        name: entry.name,
        score: entry.score,
        delta: entry.delta,
      }));

    const leaderboard = ranked.slice(0, 5);
    const playerRow = playerName ? ranked.find((entry) => entry.name === playerName) ?? null : null;
    const bridgeRow =
      playerRow && playerRow.rank > 6 && playerRow.rank === leaderboard[leaderboard.length - 1]?.rank + 2
        ? ranked.find((entry) => entry.rank === playerRow.rank - 1) ?? null
        : null;

    return NextResponse.json({ leaderboard, player_row: playerRow, bridge_row: bridgeRow, total: ranked.length });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
