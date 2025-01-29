import React from 'react';
import { Network } from '../types';

interface NetworkSelectorProps {
  networks: Network[];
  selectedNetwork: Network | null;
  onNetworkSelect: (network: Network) => void;
}

export function NetworkSelector({ networks, selectedNetwork, onNetworkSelect }: NetworkSelectorProps) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
      {networks.map((network) => (
        <button
          key={network.id}
          onClick={() => onNetworkSelect(network)}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            selectedNetwork?.id === network.id
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
          }`}
        >
          <div className="w-8 h-8 mb-2 relative">
            <img
              src={network.logoUrl}
              alt={`${network.name} logo`}
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PC9zdmc+';
              }}
            />
          </div>
          <span className="text-sm font-medium text-gray-900">{network.name}</span>
        </button>
      ))}
    </div>
  );
}