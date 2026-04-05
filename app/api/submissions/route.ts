import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEMO_GAME_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_EVENT_ID = '00000000-0000-0000-0000-000000000002';
const EVENT_TIME_MS = 3000; // 3 seconds - goal moment in football video

function calculateScore(deltaMs: number): number {
  if (deltaMs <= 300) return 100;
  if (deltaMs <= 1000) return 70;
  if (deltaMs <= 2000) return 40;
  if (deltaMs <= 5000) return 10;
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_name, guessed_time_ms } = body;

    if (!player_name || typeof guessed_time_ms !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for existing submission
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('player_name', player_name)
      .eq('event_id', DEMO_EVENT_ID)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Already submitted' },
        { status: 409 }
      );
    }

    // Calculate delta and score
    const delta_ms = Math.abs(guessed_time_ms - EVENT_TIME_MS);
    const score = calculateScore(delta_ms);

    // Insert submission
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        game_id: DEMO_GAME_ID,
        event_id: DEMO_EVENT_ID,
        player_name,
        guessed_time_ms,
        delta_ms,
        score,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save submission' },
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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
