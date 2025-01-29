import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { ConnectionLogs, ConnectionLog } from './ConnectionLogs';

interface SignatureRequest {
  id: string;
  method: string;
  params: any[];
  timestamp: number;
  pending: boolean;
}

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (uri: string, autoSign?: boolean) => Promise<void>;
  isConnecting: boolean;
}

export function WalletConnectModal({ isOpen, onClose, onConnect, isConnecting }: WalletConnectModalProps) {
  const [uri, setUri] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [autoSign, setAutoSign] = useState(false);
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [hasPendingRequests, setHasPendingRequests] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [modalState, setModalState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  // Clear state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setLogs([]);
      setUri('');
      setError(null);
      setSignatureRequests([]);
      setIsConnected(false);
      setHasPendingRequests(false);
      setModalState('idle');
    }
  }, [isOpen]);

  // Subscribe to connection events
  useEffect(() => {
    function handleConnectionLog(event: CustomEvent<ConnectionLog>) {
      setLogs(prevLogs => [...prevLogs, event.detail]);
      
      // Update connection state based on log messages
      if (event.detail.message.includes('WalletConnect session established successfully')) {
        setIsConnected(true);
        setModalState('connected');
      }
    }

    function handleSignatureRequest(event: CustomEvent<SignatureRequest>) {
      setSignatureRequests(prev => [...prev, event.detail]);
      setHasPendingRequests(true);
    }

    function handleSignatureResponse(event: CustomEvent<{ id: string; success: boolean }>) {
      setSignatureRequests(prev => {
        const updated = prev.map(req => 
          req.id === event.detail.id 
            ? { ...req, pending: false }
            : req
        );
        // Check if there are any remaining pending requests
        const hasPending = updated.some(req => req.pending);
        setHasPendingRequests(hasPending);
        return updated;
      });
    }

    window.addEventListener('walletconnect:log' as any, handleConnectionLog);
    window.addEventListener('walletconnect:request' as any, handleSignatureRequest);
    window.addEventListener('walletconnect:response' as any, handleSignatureResponse);
    
    return () => {
      window.removeEventListener('walletconnect:log' as any, handleConnectionLog);
      window.removeEventListener('walletconnect:request' as any, handleSignatureRequest);
      window.removeEventListener('walletconnect:response' as any, handleSignatureResponse);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUri = uri.trim();
    if (!trimmedUri) {
      setError('Please enter a WalletConnect URI');
      return;
    }

    if (!trimmedUri.startsWith('wc:')) {
      setError('Invalid WalletConnect URI format. URI must start with "wc:"');
      return;
    }

    try {
      setModalState('connecting');
      await onConnect(trimmedUri, autoSign);
      setUri('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setModalState('error');
    }
  };

  const formatParams = (method: string, params: any[]) => {
    switch (method) {
      case 'personal_sign':
        return `Message: ${params[1]}`;
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return 'Typed Data Signature Request';
      case 'eth_sendTransaction':
        const tx = params[0];
        return `Transaction to: ${tx.to}\nValue: ${tx.value || '0'} ETH`;
      default:
        return `Method: ${method}`;
    }
  };

  const handleSignatureAction = (requestId: string, approve: boolean) => {
    window.dispatchEvent(
      new CustomEvent('walletconnect:signature', {
        detail: { id: requestId, approve }
      })
    );
  };

  // Determine if the modal can be closed
  const canClose = modalState === 'idle' || modalState === 'error';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
        <button
          onClick={() => canClose && onClose()}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canClose}
          title={
            modalState === 'connected'
              ? "Can't close while connection is active"
              : modalState === 'connecting'
                ? "Can't close while connecting"
                : hasPendingRequests
                  ? "Can't close while requests are pending"
                  : "Close"
          }
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-4">Connect Wallet</h2>
        
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="mb-4">
            <label htmlFor="wcUri" className="block text-sm font-medium text-gray-700 mb-1">
              WalletConnect URI
            </label>
            <input
              id="wcUri"
              type="text"
              value={uri}
              onChange={(e) => {
                setUri(e.target.value);
                setError(null);
              }}
              placeholder="wc:..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={modalState !== 'idle'}
            />
            <p className="mt-1 text-sm text-gray-500">
              Paste the WalletConnect URI from your wallet app
            </p>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setAutoSign(!autoSign)}
                className="text-gray-600 hover:text-gray-900 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={modalState !== 'idle'}
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

          <button
            type="submit"
            disabled={modalState !== 'idle' || !uri.trim()}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {modalState === 'connecting' ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : modalState === 'connected' ? (
              'Connected'
            ) : (
              'Connect'
            )}
          </button>
        </form>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {signatureRequests.length > 0 && !autoSign && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Signature Requests</h3>
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
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {request.method}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatParams(request.method, request.params)}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(request.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {request.pending && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSignatureAction(request.id, true)}
                            className="flex-1 bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleSignatureAction(request.id, false)}
                            className="flex-1 bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
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
            <ConnectionLogs logs={logs} />
          </div>
        </div>

        {modalState !== 'idle' && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-700">
              {modalState === 'connected'
                ? 'Connection is active. Please keep this window open.'
                : modalState === 'connecting'
                  ? 'Please wait while connecting...'
                  : hasPendingRequests
                    ? 'Please handle all pending requests before closing'
                    : 'Please wait...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}