import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/config';
import { logger } from '@/utils/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebSocketImpl = require('ws');

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocketImpl },
    });
    logger.info('Supabase client initialized');
  }
  return client;
}
