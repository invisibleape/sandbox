import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase configuration error:', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey
  });
  throw new Error('Missing required Supabase environment variables');
}

// Retry configuration
const RETRY_COUNT = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const REQUEST_TIMEOUT = 60000; // 60 seconds

// Create a custom fetch implementation with retries and better error handling
const customFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < RETRY_COUNT) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        keepalive: true,
        credentials: 'include',
        mode: 'cors',
        headers: {
          ...init?.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      clearTimeout(timeoutId);

      // Log response details for debugging
      console.debug('Supabase response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        attempt: attempt + 1
      });

      // Check if we should retry based on the response
      if (!response.ok) {
        const shouldRetry = (
          response.status >= 500 || 
          response.status === 429 || 
          response.status === 408 ||
          response.status === 503 ||
          response.status === 504
        );

        if (shouldRetry && attempt < RETRY_COUNT - 1) {
          const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
          console.warn(`Request failed with status ${response.status}. Retrying in ${delay}ms... (attempt ${attempt + 1}/${RETRY_COUNT})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      console.error('Supabase request error:', {
        url,
        error: lastError,
        message: lastError.message,
        stack: lastError.stack,
        attempt: attempt + 1
      });

      // Only retry on network errors, timeouts, or API verification errors
      const shouldRetry = (
        lastError.name === 'AbortError' ||
        lastError.message.includes('Failed to fetch') ||
        lastError.message.includes('verify-api') ||
        lastError.message.includes('network error')
      );

      if (shouldRetry && attempt < RETRY_COUNT - 1) {
        const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
        console.warn(`Request failed. Retrying in ${delay}ms... (attempt ${attempt + 1}/${RETRY_COUNT})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Maximum retry attempts reached');
};

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
        'X-Client-Info': 'supabase-js/2.39.7'
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
    fetch: customFetch
  }
);

// Function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  const isConfigured = !!supabaseUrl && !!supabaseServiceKey;
  console.log('Supabase configuration check:', { isConfigured });
  return isConfigured;
}

// Function to test connection with better error handling and retries
export async function testSupabaseConnection(): Promise<boolean> {
  console.log('Testing Supabase connection...');
  
  let attempt = 0;
  
  while (attempt < RETRY_COUNT) {
    try {
      // Try a simple query to test the connection
      const { data, error } = await supabase
        .from('wallets')
        .select('id')
        .limit(1)
        .maybeSingle();
      
      if (error) {
        // PGRST116 means no rows found, which is fine
        if (error.code === 'PGRST116') {
          console.log('Supabase connection successful (no rows found)');
          return true;
        }
        
        throw error;
      }

      console.log('Supabase connection successful');
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      
      console.error('Supabase connection test error:', {
        error,
        message: error.message,
        stack: error.stack,
        attempt: attempt + 1
      });
      
      if (attempt < RETRY_COUNT - 1) {
        const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
        console.warn(`Retrying connection in ${delay}ms (attempt ${attempt + 1}/${RETRY_COUNT})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        continue;
      }
      
      return false;
    }
  }
  
  return false;
}