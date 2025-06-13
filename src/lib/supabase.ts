import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-application-name': 'chat-app',
    },
  },
});

// Add retry logic for failed requests
export async function queryWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  maxRetries = 3,
  delay = 1000
): Promise<{ data: T | null; error: any }> {
  let retries = 0;
  let lastError: any;

  while (retries < maxRetries) {
    try {
      const result = await queryFn();
      if (result.error) {
        throw result.error;
      }
      return result;
    } catch (error) {
      lastError = error;
      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * retries));
      }
    }
  }

  return { data: null, error: lastError };
}

// Handle WebSocket connection errors
supabase.channel('system').on('system', { event: '*' }, (payload) => {
  console.log('System event:', payload);
}).subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    console.log('WebSocket connected');
  } else if (status === 'CLOSED') {
    console.log('WebSocket disconnected');
  } else if (status === 'CHANNEL_ERROR') {
    console.error('WebSocket channel error');
  }
});

// Export types
export type { Database } from '../types/supabase';