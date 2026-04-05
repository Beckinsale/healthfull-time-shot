import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEMO_EVENT_ID = '00000000-0000-0000-0000-000000000002';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const player_name = searchParams.get('player_name');

    if (!player_name) {
      return NextResponse.json(
        { error: 'Missing player_name parameter' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('guessed_time_ms, delta_ms, score')
      .eq('player_name', player_name)
      .eq('event_id', DEMO_EVENT_ID)
      .single();

    if (error) {
      // No submission found
      return NextResponse.json({ has_submitted: false });
    }

    return NextResponse.json({
      has_submitted: true,
      submission: data,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
