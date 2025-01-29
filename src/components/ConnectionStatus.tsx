import React, { useEffect, useState } from 'react';
import { Loader2, Power, PowerOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConnectionStatusProps {
  walletId: string;
  onStatusChange?: (isConnected: boolean) => void;
}

export function ConnectionStatus({ walletId, onStatusChange }: ConnectionStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const checkStatus = async () => {
    try {
      setIsChecking(true);
      const { data, error } = await supabase
        .from('wallets')
        .select('status')
        .eq('id', walletId)
        .single();

      if (error) throw error;

      const connected = data.status === 'connected';
      setIsConnected(connected);
      onStatusChange?.(connected);
    } catch (error) {
      console.error('Failed to check wallet status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const disconnect = async () => {
    try {
      setIsDisconnecting(true);
      
      const { error } = await supabase
        .from('wallets')
        .update({ status: 'created' })
        .eq('id', walletId);

      if (error) throw error;

      setIsConnected(false);
      onStatusChange?.(false);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [walletId]);

  if (isChecking) {
    return (
      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
    );
  }

  if (!isConnected) {
    return (
      <PowerOff className="w-4 h-4 text-gray-400" />
    );
  }

  return (
    <button
      onClick={disconnect}
      disabled={isDisconnecting}
      className="text-red-600 hover:text-red-800 disabled:opacity-50"
      title="Disconnect wallet"
    >
      {isDisconnecting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Power className="w-4 h-4" />
      )}
    </button>
  );
}