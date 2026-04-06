import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000002';

function isSupabaseNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return message.includes('fetch failed') || message.includes('Connect Timeout Error');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ has_submitted: false, unavailable: true }, { status: 503 });
    }

    const searchParams = request.nextUrl.searchParams;
    const player_name = searchParams.get('player_name');
    const event_id = searchParams.get('event_id') || DEFAULT_EVENT_ID;

    if (!player_name) {
      return NextResponse.json(
        { error: 'Отсутствует параметр player_name' },
        { status: 400 }
      );
    }

    const signal = AbortSignal.timeout(4000);

    const { data, error } = await supabase
      .from('submissions')
      .select('guessed_time_ms, delta_ms, score')
      .eq('player_name', player_name)
      .eq('event_id', event_id)
      .abortSignal(signal)
      .single();

    if (error) {
      if (isSupabaseNetworkError(error)) {
        return NextResponse.json({ has_submitted: false, unavailable: true });
      }

      return NextResponse.json({ has_submitted: false });
    }

    return NextResponse.json({
      has_submitted: true,
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
