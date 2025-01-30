import { supabase } from './supabase';
import { ConnectionLog } from '../components/ConnectionLogs';

export async function storeLog(log: Omit<ConnectionLog, 'id'>, walletId: string | null) {
  if (!walletId) return;

  try {
    const { error } = await supabase
      .from('wallet_logs')
      .insert({
        wallet_id: walletId,
        type: log.type,
        message: log.message,
        details: log.details,
        created_at: new Date(log.timestamp).toISOString()
      });

    if (error) {
      console.error('Failed to store log:', error);
    }
  } catch (error) {
    console.error('Error storing log:', error);
  }
}

export async function getWalletLogs(walletId: string): Promise<ConnectionLog[]> {
  try {
    const { data, error } = await supabase
      .from('wallet_logs')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(log => ({
      id: log.id,
      type: log.type,
      message: log.message,
      timestamp: new Date(log.created_at).getTime(),
      details: log.details,
      walletId: log.wallet_id
    }));
  } catch (error) {
    console.error('Error fetching wallet logs:', error);
    return [];
  }
}