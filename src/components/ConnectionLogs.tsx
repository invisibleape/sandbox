import React from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export interface ConnectionLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'pending';
}

interface ConnectionLogsProps {
  logs: ConnectionLog[];
}

export function ConnectionLogs({ logs }: ConnectionLogsProps) {
  return (
    <div className="mt-4 border border-gray-200 rounded-md bg-gray-50 h-48 overflow-y-auto">
      <div className="p-3 space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-2 text-sm font-mono"
          >
            <div className="flex-shrink-0 mt-1">
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
                <div className="w-4 h-4 rounded-full bg-gray-400" />
              )}
            </div>
            <div className="flex-1 break-all">
              <span className="text-gray-500 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`
                ${log.type === 'success' && 'text-green-700'}
                ${log.type === 'error' && 'text-red-700'}
                ${log.type === 'pending' && 'text-blue-700'}
                ${log.type === 'info' && 'text-gray-700'}
              `}>
                {log.message}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}