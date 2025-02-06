import React, { useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Copy, Check, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface ConnectionLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'pending';
  walletId?: string;
  details?: any;
}

interface ConnectionLogsProps {
  logs: ConnectionLog[];
  maxHeight?: string;
  onClearLogs?: () => void;
}

export function ConnectionLogs({ logs, maxHeight = "24rem", onClearLogs }: ConnectionLogsProps) {
  const logsRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const lastScrollTop = useRef(0);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsRef.current && autoScroll) {
      const { scrollHeight, clientHeight } = logsRef.current;
      logsRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [logs, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!logsRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsRef.current;
    const isScrollingUp = scrollTop < lastScrollTop.current;
    const isAtBottom = scrollHeight - clientHeight <= scrollTop + 1;

    if (isScrollingUp) {
      setAutoScroll(false);
    } else if (isAtBottom) {
      setAutoScroll(true);
    }

    lastScrollTop.current = scrollTop;
  };

  const copyLogs = async () => {
    if (!logsRef.current) return;

    const formattedLogs = logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });
      
      let logText = `[${timestamp}] ${log.type.toUpperCase()}: ${log.message}`;
      
      // Include details if they exist
      if (log.details) {
        logText += '\n' + JSON.stringify(log.details, null, 2)
          .split('\n')
          .map(line => '  ' + line) // Indent details
          .join('\n');
      }
      
      return logText;
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(formattedLogs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const handleClearLogs = async () => {
    if (!onClearLogs || isDeleting) return;

    if (logs.length > 0 && window.confirm('Are you sure you want to clear all logs? This will delete them from the database.')) {
      setIsDeleting(true);
      try {
        // Get unique wallet IDs from logs
        const walletIds = [...new Set(logs.map(log => log.walletId).filter(Boolean))];
        
        // Delete logs from database for each wallet
        for (const walletId of walletIds) {
          const { error } = await supabase
            .from('wallet_logs')
            .delete()
            .eq('wallet_id', walletId);
          
          if (error) {
            throw error;
          }
        }

        // Call the onClearLogs callback to clear the UI
        onClearLogs();
        setAutoScroll(true);
      } catch (error) {
        console.error('Failed to clear logs:', error);
        alert('Failed to clear logs. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const formatLogDetails = (details: any): string => {
    try {
      return JSON.stringify(details, null, 2);
    } catch (error) {
      return '[Unable to format details]';
    }
  };

  return (
    <div className="relative bg-white rounded-lg shadow-sm">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`p-1.5 text-gray-500 hover:text-gray-700 bg-white/90 hover:bg-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm ${
            autoScroll ? 'text-indigo-600' : ''
          }`}
          title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 12h-5l3 3-3 3" />
            <path d="M17 6h-5l3-3-3-3" />
            <line x1="7" y1="3" x2="7" y2="21" />
          </svg>
        </button>
        <button
          onClick={copyLogs}
          className="p-1.5 text-gray-500 hover:text-gray-700 bg-white/90 hover:bg-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          title="Copy logs to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        {onClearLogs && (
          <button
            onClick={handleClearLogs}
            disabled={isDeleting}
            className="p-1.5 text-gray-500 hover:text-red-600 bg-white/90 hover:bg-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm disabled:opacity-50"
            title="Clear logs"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      <div 
        ref={logsRef}
        onScroll={handleScroll}
        className="overflow-y-auto font-mono text-sm leading-relaxed scroll-smooth"
        style={{ 
          scrollBehavior: 'smooth',
          maxHeight,
          background: 'linear-gradient(to bottom, #f9fafb, #ffffff)'
        }}
      >
        <div className="p-4 space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 hover:bg-white/80 p-2 rounded-md transition-colors break-words border border-transparent hover:border-gray-100 shadow-sm"
            >
              <div className="flex-shrink-0 mt-0.5">
                {log.type === 'success' && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
                {log.type === 'error' && (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                {log.type === 'pending' && (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                )}
                {log.type === 'info' && (
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-gray-500 font-semibold tracking-wider">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      fractionalSecondDigits: 3
                    })}
                  </span>
                </div>
                <div className={`
                  ${log.type === 'success' && 'text-green-700 font-medium'}
                  ${log.type === 'error' && 'text-red-700 font-medium'}
                  ${log.type === 'pending' && 'text-blue-700 font-medium'}
                  ${log.type === 'info' && 'text-gray-900'}
                  break-all leading-relaxed
                `}>
                  <span className="whitespace-pre-wrap">{log.message}</span>
                  {log.details && (
                    <pre className="mt-1 text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                      {formatLogDetails(log.details)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
          {/* Spacer to ensure last log is visible */}
          <div className="h-6" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}