import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required Supabase environment variables');
  throw new Error('Missing required Supabase environment variables');
}

// Create Supabase client with simplified configuration
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
    }
  }
);

// Function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseServiceKey;
}

// Function to test connection with retries
export async function testSupabaseConnection(): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('id')
        .limit(1)
        .maybeSingle();
      
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
      console.error('Connection test error:', {
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  
  return false;
}