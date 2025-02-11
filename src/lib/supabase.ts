import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required Supabase environment variables');
  throw new Error('Missing required Supabase environment variables');
}

// Create Supabase client with improved configuration
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

// Function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseServiceKey;
}

// Function to test connection with improved error handling
export async function testSupabaseConnection(): Promise<boolean> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('wallets')
      .select('id')
      .limit(1)
      .single();

    if (error) {
      // PGRST116 means no rows found, which is fine
      if (error.code === 'PGRST116') {
        console.log('Supabase connection successful (no rows)');
        return true;
      }
      throw error;
    }

    console.log('Supabase connection successful');
    return true;
  }, 3, 1000);
}

// Helper function to handle Supabase requests with retries
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  timeout: number = 10000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Operation timeout'));
          });
        })
      ]);

      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      const isTimeout = lastError.message === 'Operation timeout';
      const isAborted = lastError.name === 'AbortError';
      const isNetworkError = lastError.message.includes('Failed to fetch');
      
      if (attempt === maxRetries - 1 || (!isTimeout && !isNetworkError)) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retrying operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}