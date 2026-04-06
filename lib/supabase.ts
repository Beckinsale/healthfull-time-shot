import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

export type Database = {
  games: {
    id: string;
    title: string;
    video_url: string;
    created_at: string;
  };
  events: {
    id: string;
    game_id: string;
    event_time_ms: number;
    label: string;
    created_at: string;
  };
  submissions: {
    id: string;
    game_id: string;
    event_id: string;
    player_name: string;
    guessed_time_ms: number;
    delta_ms: number;
    score: number;
    created_at: string;
  };
};
