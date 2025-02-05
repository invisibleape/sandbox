import React, { useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Copy, Check, Trash2 } from 'lucide-react';

export interface ConnectionLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'pending';
  walletId?: string;
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

    // Only update autoScroll if user is actively scrolling up or down
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
      return `[${timestamp}] ${log.type.toUpperCase()}: ${log.message}`;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(formattedLogs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const handleClearLogs = () => {
    if (onClearLogs) {
      // Ask for confirmation before clearing logs
      if (logs.length > 0 && window.confirm('Are you sure you want to clear all logs?')) {
        onClearLogs();
        setAutoScroll(true); // Reset auto-scroll when clearing logs
      }
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
            className="p-1.5 text-gray-500 hover:text-red-600 bg-white/90 hover:bg-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
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
                <span className={`
                  ${log.type === 'success' && 'text-green-700 font-medium'}
                  ${log.type === 'error' && 'text-red-700 font-medium'}
                  ${log.type === 'pending' && 'text-blue-700 font-medium'}
                  ${log.type === 'info' && 'text-gray-900'}
                  break-all leading-relaxed
                `}>
                  {log.message}
                </span>
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