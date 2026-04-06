import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateScoreForGame, type GameScoreMode } from '@/lib/scoring';

type GuessType = 'goal' | 'kill' | 'headshot';

const EVENTS: Record<string, { game_id: string; event_time_ms: number; label: string; game_mode: GameScoreMode }> = {
  '00000000-0000-0000-0000-000000000002': {
    game_id: '00000000-0000-0000-0000-000000000001',
    event_time_ms: 3750,
    label: 'Goal',
    game_mode: 'football',
  },
  '00000000-0000-0000-0000-000000000003': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 3750,
    label: 'CS2 Event 1',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-000000000004': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 6820,
    label: 'CS2 Event 2',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-000000000005': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 8290,
    label: 'CS2 Event 3',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-000000000006': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 9280,
    label: 'CS2 Event 4',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-000000000007': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 15700,
    label: 'CS2 Event 5',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-000000000008': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 19976,
    label: 'CS2 Event 6',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-000000000009': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 21200,
    label: 'CS2 Event 7',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-00000000000a': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 24700,
    label: 'CS2 Event 8',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-00000000000b': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 26700,
    label: 'CS2 Event 9',
    game_mode: 'cs2',
  },
};

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000002';

function applyGuessTypeScore(baseScore: number, guessType: GuessType): number {
  if (guessType === 'kill') {
    return Math.round(baseScore / 2);
  }

  return baseScore;
}

function isSupabaseNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return message.includes('fetch failed') || message.includes('Connect Timeout Error');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Хранилище временно недоступно. Повторите попытку через несколько секунд.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { player_name, guessed_time_ms, event_id, guess_type } = body;
    const selectedEventId = typeof event_id === 'string' ? event_id : DEFAULT_EVENT_ID;
    const selectedGuessType: GuessType = guess_type === 'kill' || guess_type === 'headshot' || guess_type === 'goal' ? guess_type : 'headshot';
    const selectedEvent = EVENTS[selectedEventId];

    if (!player_name || typeof guessed_time_ms !== 'number') {
      return NextResponse.json(
        { error: 'Отсутствуют обязательные поля' },
        { status: 400 }
      );
    }

    if (!selectedEvent) {
      return NextResponse.json(
        { error: 'Некорректное событие' },
        { status: 400 }
      );
    }

    const existingSignal = AbortSignal.timeout(4000);

    const { data: existing, error: existingError } = await supabase
      .from('submissions')
      .select('id')
      .eq('player_name', player_name)
      .eq('event_id', selectedEventId)
      .abortSignal(existingSignal)
      .single();

    if (existingError && isSupabaseNetworkError(existingError)) {
      return NextResponse.json(
        { error: 'Хранилище временно недоступно. Повторите попытку через несколько секунд.' },
        { status: 503 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Результат уже отправлен' },
        { status: 409 }
      );
    }

    const signed_diff_ms = guessed_time_ms - selectedEvent.event_time_ms;
    const delta_ms = Math.abs(signed_diff_ms);
    const baseScore = calculateScoreForGame(selectedEvent.game_mode, signed_diff_ms);
    const score = applyGuessTypeScore(baseScore, selectedGuessType);

    const insertSignal = AbortSignal.timeout(4000);

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        game_id: selectedEvent.game_id,
        event_id: selectedEventId,
        player_name,
        guessed_time_ms,
        delta_ms,
        score,
      })
      .abortSignal(insertSignal)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Результат уже отправлен' },
          { status: 409 }
        );
      }

      console.error('Supabase error:', error);

      if (isSupabaseNetworkError(error)) {
        return NextResponse.json(
          { error: 'Хранилище временно недоступно. Повторите попытку через несколько секунд.' },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: 'Не удалось сохранить результат' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      submission: data,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
