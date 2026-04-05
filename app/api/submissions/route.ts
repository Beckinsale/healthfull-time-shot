import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateScoreForGame, type GameScoreMode } from '@/lib/scoring';

const EVENTS: Record<string, { game_id: string; event_time_ms: number; label: string; game_mode: GameScoreMode }> = {
  '00000000-0000-0000-0000-000000000002': {
    game_id: '00000000-0000-0000-0000-000000000001',
    event_time_ms: 3000,
    label: 'Goal',
    game_mode: 'football',
  },
  '00000000-0000-0000-0000-000000000003': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 900,
    label: 'Headshot 1',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-000000000004': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 3000,
    label: 'Headshot 2',
    game_mode: 'cs2',
  },
  '00000000-0000-0000-0000-000000000005': {
    game_id: '00000000-0000-0000-0000-000000000010',
    event_time_ms: 7000,
    label: 'Headshot 3',
    game_mode: 'cs2',
  },
};

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000002';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_name, guessed_time_ms, event_id } = body;
    const selectedEventId = typeof event_id === 'string' ? event_id : DEFAULT_EVENT_ID;
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

    // Check for existing submission
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('player_name', player_name)
      .eq('event_id', selectedEventId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Результат уже отправлен' },
        { status: 409 }
      );
    }

    // Calculate delta and score
    const signed_diff_ms = guessed_time_ms - selectedEvent.event_time_ms;
    const delta_ms = Math.abs(signed_diff_ms);
    const score = calculateScoreForGame(selectedEvent.game_mode, signed_diff_ms);

    // Insert submission
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
