import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ToggleLeft, ToggleRight, Loader2, CheckCircle2, XCircle, FileText, Key } from 'lucide-react';
import { ConnectionLogs, ConnectionLog } from './ConnectionLogs';
import { getWalletLogs } from '../lib/logs';

interface SignatureRequest {
  id: string;
  method: string;
  params: any[];
  timestamp: number;
  pending: boolean;
}

interface ReownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (uri: string, autoSign?: boolean) => Promise<void>;
  isConnecting: boolean;
  walletId: string | null;
}

function formatSignatureMessage(message: string): string {
  if (!message) return '';
  
  // If it's a hex string, try to decode it
  if (message.startsWith('0x')) {
    try {
      const decoded = new TextDecoder().decode(
        new Uint8Array(
          message
            .slice(2)
            .match(/.{1,2}/g)!
            .map(byte => parseInt(byte, 16))
        )
      );
      return decoded;
    } catch {
      return message;
    }
  }
  
  return message;
}

export function ReownModal({ isOpen, onClose, onConnect, isConnecting, walletId }: ReownModalProps) {
  const [uri, setUri] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [autoSign, setAutoSign] = useState(true);
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [hasPendingRequests, setHasPendingRequests] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Auto-connect when valid URI is pasted
  useEffect(() => {
    const trimmedUri = uri.trim();
    if (trimmedUri && (trimmedUri.startsWith('wc:') || trimmedUri.startsWith('reown:'))) {
      handleConnect();
    }
  }, [uri]);

  // Only clear URI and error when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setUri('');
      setError(null);
      setIsConnected(false);
      setHasPendingRequests(false);
      setSignatureRequests([]);
      setLogs([]);
    }
  }, [isOpen]);

  // Load existing logs when wallet is selected
  useEffect(() => {
    if (walletId) {
      getWalletLogs(walletId).then(walletLogs => {
        setLogs(walletLogs);
      });
    }
  }, [walletId]);

  // Subscribe to connection events
  useEffect(() => {
    function handleConnectionLog(event: CustomEvent<ConnectionLog>) {
      // Only add logs for the selected wallet
      if (event.detail.walletId === walletId) {
        setLogs(prevLogs => [...prevLogs, event.detail]);
      }
      
      if (event.detail.message.includes('Reown session established successfully')) {
        setIsConnected(true);
      }
    }

    function handleSignatureRequest(event: CustomEvent<SignatureRequest>) {
      setSignatureRequests(prev => [...prev, event.detail]);
      setHasPendingRequests(true);

      // Add a log entry for the signature request
      const message = formatRequestMessage(event.detail);
      setLogs(prevLogs => [...prevLogs, {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'pending',
        message: `Signature request: ${message}`,
        walletId
      }]);
    }

    function handleSignatureResponse(event: CustomEvent<{ id: string; success: boolean; error?: string }>) {
      setSignatureRequests(prev => {
        // Remove the handled request
        const updated = prev.filter(req => req.id !== event.detail.id);
        const hasPending = updated.some(req => req.pending);
        setHasPendingRequests(hasPending);
        return updated;
      });

      // Add a log entry for the response
      setLogs(prevLogs => [...prevLogs, {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: event.detail.success ? 'success' : 'error',
        message: event.detail.success 
          ? 'Signature request approved'
          : `Signature request failed: ${event.detail.error || 'User rejected'}`,
        walletId
      }]);
    }

    window.addEventListener('reown:log' as any, handleConnectionLog);
    window.addEventListener('reown:request' as any, handleSignatureRequest);
    window.addEventListener('reown:response' as any, handleSignatureResponse);
    
    return () => {
      window.removeEventListener('reown:log' as any, handleConnectionLog);
      window.removeEventListener('reown:request' as any, handleSignatureRequest);
      window.removeEventListener('reown:response' as any, handleSignatureResponse);
    };
  }, [walletId]);

  const handleConnect = async () => {
    const trimmedUri = uri.trim();
    if (!trimmedUri) {
      setError('Please enter a URI');
      return;
    }

    if (!trimmedUri.startsWith('wc:') && !trimmedUri.startsWith('reown:')) {
      setError('Invalid URI format. URI must start with "wc:" or "reown:"');
      return;
    }

    try {
      await onConnect(trimmedUri, autoSign);
      setUri('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  const formatRequestMessage = (request: SignatureRequest) => {
    switch (request.method) {
      case 'personal_sign': {
        const message = request.params[0];
        return `Sign message: ${
          typeof message === 'string' 
            ? formatSignatureMessage(message)
            : 'Binary message'
        }`;
      }
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4': {
        const data = request.params[1];
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        return `Sign typed data: ${parsedData.domain.name || 'Unknown domain'} - ${parsedData.primaryType}`;
      }
      default:
        return `Method: ${request.method}`;
    }
  };

  const handleSignatureAction = (requestId: string, approve: boolean) => {
    window.dispatchEvent(
      new CustomEvent('reown:signature', {
        detail: { id: requestId, approve }
      })
    );
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  // Determine if the modal can be closed
  const canClose = !isConnecting && !hasPendingRequests;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
        <button
          onClick={() => canClose && onClose()}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canClose}
          title={
            isConnecting
              ? "Can't close while connecting"
              : hasPendingRequests
                ? "Can't close while requests are pending"
                : "Close"
          }
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-4">Connect Wallet</h2>
        
        <form onSubmit={(e) => { e.preventDefault(); handleConnect(); }} className="mb-4">
          <div className="mb-4">
            <label htmlFor="reownUri" className="block text-sm font-medium text-gray-700 mb-1">
              Connection URI
            </label>
            <input
              id="reownUri"
              type="text"
              value={uri}
              onChange={(e) => {
                setUri(e.target.value);
                setError(null);
              }}
              placeholder="wc:... or reown:..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isConnecting}
            />
            <p className="mt-1 text-sm text-gray-500">
              Paste the connection URI from your wallet app
            </p>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setAutoSign(!autoSign)}
                className="text-gray-600 hover:text-gray-900 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isConnecting}
              >
                {autoSign ? (
                  <ToggleRight className="w-6 h-6 text-indigo-600" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>
              <span className="text-sm font-medium text-gray-700">
                Auto-sign requests
              </span>
            </label>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
        </form>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {signatureRequests.length > 0 && !autoSign && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Pending Signature Requests</h3>
              <div className="space-y-2">
                {signatureRequests.map((request, index) => (
                  <div
                    key={`${request.id}-${index}`}
                    className={`p-4 rounded-md border ${
                      request.pending
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {request.method === 'personal_sign' ? (
                            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Key className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {request.method === 'personal_sign' ? 'Sign Message' : 'Sign Typed Data'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap font-mono">
                              {formatRequestMessage(request)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(request.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {request.pending && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSignatureAction(request.id, true)}
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleSignatureAction(request.id, false)}
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Connection Log</h3>
            <ConnectionLogs 
              logs={logs} 
              maxHeight="calc(100vh - 24rem)" 
              onClearLogs={handleClearLogs}
            />
          </div>
        </div>
      </div>
    </div>
  );
}