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
    },
    // Add retryable fetch configuration with better error handling
    fetch: (url, options = {}) => {
      const MAX_RETRIES = 3;
      const INITIAL_DELAY = 1000;
      const MAX_DELAY = 5000;
      const TIMEOUT = 10000;

      const fetchWithRetry = async (attempt = 0): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              ...options.headers,
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          clearTimeout(timeoutId);

          if (!response.ok && attempt < MAX_RETRIES) {
            const error = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP error! status: ${response.status}, message: ${error}`);
          }

          return response;
        } catch (error) {
          clearTimeout(timeoutId);

          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timeout');
          }

          if (attempt >= MAX_RETRIES) {
            throw error;
          }

          const delay = Math.min(INITIAL_DELAY * Math.pow(2, attempt), MAX_DELAY);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(attempt + 1);
        }
      };

      return fetchWithRetry();
    }
  }
);

// Function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseServiceKey;
}

// Function to test connection with improved error handling
export async function testSupabaseConnection(): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  const TIMEOUT = 10000;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const { data, error } = await supabase
        .from('wallets')
        .select('id')
        .limit(1)
        .maybeSingle()
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

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
    } catch (err) {
      const isTimeout = err instanceof Error && (
        err.message === 'Request timeout' || 
        err.name === 'AbortError'
      );
      const isLastAttempt = attempt === MAX_RETRIES - 1;
      
      console.error('Connection test error:', {
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : 'Unknown error',
        isTimeout,
        isLastAttempt
      });
      
      if (!isLastAttempt) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  return false;
}

// Helper function to handle Supabase requests with retries and timeouts
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
      
      if (attempt === maxRetries - 1 || isAborted) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retrying operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}