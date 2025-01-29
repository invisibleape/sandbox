import { supabase } from './supabase';

interface SignRequest {
  walletId: string;
  method: string;
  params: any[];
}

export async function signWithBackend(request: SignRequest): Promise<any> {
  const { data, error } = await supabase.functions.invoke('sign', {
    body: request
  });

  if (error) {
    throw new Error(`Signing failed: ${error.message}`);
  }

  if (data.error) {
    throw new Error(`Signing failed: ${data.error}`);
  }

  return data.result;
}