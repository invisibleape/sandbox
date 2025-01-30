import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Wallet as WalletIcon, Activity, CheckCircle, Loader2, Copy, AlertCircle, ExternalLink, Tag, Search, ChevronLeft, ChevronRight, RefreshCw, Clock } from 'lucide-react';
import { WalletStats, Network } from '../types';
import { generateWallets, getWalletCount, getWallets, formatAddress } from '../lib/wallet';
import { isSupabaseConfigured, testSupabaseConnection, supabase } from '../lib/supabase';
import { networks } from '../lib/networks';
import { NetworkSelector } from './NetworkSelector';
import { ReownModal } from './ReownModal';
import { ConnectionStatus } from './ConnectionStatus';
import { connectWallet } from '../lib/auth';
import { decryptPrivateKey } from '../lib/crypto';
import { getInfuraKey } from '../lib/infura';
import { getWalletKit } from '../lib/walletkit';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 300; // 300ms for search/filter debouncing

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

const StatsCard = ({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) => (
  <div className="bg-white rounded-lg p-6 shadow-md">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </div>
      <Icon className="w-8 h-8 text-indigo-500" />
    </div>
  </div>
);

function Dashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasInfuraKey, setHasInfuraKey] = useState(false);
  const [stats, setStats] = useState<WalletStats>({
    totalWallets: 0,
    connectedWallets: 0,
    mintingWallets: 0,
    completedWallets: 0,
  });
  const [recentWallets, setRecentWallets] = useState<any[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(networks[0]);
  const [walletCount, setWalletCount] = useState<number>(100);
  const [editingTag, setEditingTag] = useState<{ id: string; tag: string } | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterNetwork, setFilterNetwork] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReownModalOpen, setIsReownModalOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const debouncedSearch = useDebounce(search, DEBOUNCE_DELAY);
  const debouncedFilterNetwork = useDebounce(filterNetwork, DEBOUNCE_DELAY);
  const debouncedFilterStatus = useDebounce(filterStatus, DEBOUNCE_DELAY);

  const refreshData = useCallback(async (showLoading = true) => {
    if (!isConnected) return;

    try {
      if (showLoading) {
        setIsLoading(true);
      }

      const totalWallets = await getWalletCount();
      
      const { data: wallets, count, totalPages: pages } = await getWallets({
        search: debouncedSearch,
        network: debouncedFilterNetwork,
        status: debouncedFilterStatus,
        page: currentPage,
        limit: 10
      });
      
      if (wallets) {
        setRecentWallets(wallets);
        setTotalPages(pages);
        
        const connected = wallets.filter(w => w.status === 'connected').length;
        const minting = wallets.filter(w => w.status === 'minting').length;
        const completed = wallets.filter(w => w.status === 'completed').length;
        
        setStats({
          totalWallets,
          connectedWallets: connected,
          mintingWallets: minting,
          completedWallets: completed,
        });
        
        setError(null);
      }
      
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to fetch wallet data. Please try again.');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [isConnected, debouncedSearch, debouncedFilterNetwork, debouncedFilterStatus, currentPage]);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const intervalId = setInterval(() => {
      refreshData(false);
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [refreshData, autoRefreshEnabled]);

  useEffect(() => {
    refreshData();
  }, [debouncedSearch, debouncedFilterNetwork, debouncedFilterStatus, currentPage, refreshData]);

  const checkConnection = async () => {
    if (!isSupabaseConfigured()) {
      setError('Please connect to Supabase first using the "Connect to Supabase" button in the top right.');
      setIsConnected(false);
      return;
    }

    const connected = await testSupabaseConnection();
    setIsConnected(connected);
    
    if (connected) {
      const infuraKey = await getInfuraKey();
      setHasInfuraKey(!!infuraKey);
      refreshData();
    } else {
      setError('Unable to connect to Supabase. Please check your connection and try again.');
    }
  };

  const handleGenerateWallets = async () => {
    if (!isConnected) {
      setError('Please connect to Supabase first using the "Connect to Supabase" button in the top right.');
      return;
    }

    if (!hasInfuraKey) {
      setError('No Infura API key found. Please add an Infura API key to the database first.');
      return;
    }

    if (!selectedNetwork) {
      setError('Please select a network first.');
      return;
    }

    const supportedNetworks = ['ethereum', 'polygon', 'arbitrum', 'linea', 'base'];
    if (!supportedNetworks.includes(selectedNetwork.id)) {
      setError(`${selectedNetwork.name} is not supported by Infura. Please select a supported network.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const { data, error: genError } = await generateWallets(walletCount, selectedNetwork);
      if (genError) throw genError;
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wallets');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      created: 'bg-blue-100 text-blue-800',
      connected: 'bg-green-100 text-green-800',
      minting: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-indigo-100 text-indigo-800',
      failed: 'bg-red-100 text-red-800',
    } as const;
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const handleTagUpdate = async (walletId: string, newTag: string) => {
    try {
      const { error } = await supabase
        .from('wallets')
        .update({ tag: newTag })
        .eq('id', walletId);

      if (error) {
        console.error('Error updating tag:', error);
        setError(`Failed to update tag: ${error.message}`);
        return;
      }
      
      await refreshData();
      setEditingTag(null);
      setError(null);
    } catch (err) {
      console.error('Error updating tag:', err);
      setError('Failed to update tag. Please try again.');
    }
  };

  const getExplorerUrl = (network: string, address: string) => {
    const networkConfig = networks.find(n => n.id === network);
    return networkConfig ? `${networkConfig.explorerUrl}/address/${address}` : null;
  };

  const handleRefresh = () => {
    refreshData();
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
  };

  const handleWalletConnect = async (uri: string, autoSign?: boolean) => {
    if (!selectedWalletId) {
      setError('No wallet selected');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wallet = recentWallets.find(w => w.id === selectedWalletId);
      if (!wallet) {
        throw new Error('Selected wallet not found');
      }

      const network = networks.find(n => n.id === wallet.network);
      if (!network) {
        throw new Error(`Network ${wallet.network} not supported`);
      }

      await connectWallet(uri, selectedWalletId, network, autoSign);
      await refreshData();
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Token Gating Test Dashboard</h1>
              <p className="mt-2 text-gray-600">Monitor and manage your wallet operations</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Data
                  </>
                )}
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Last refreshed: {formatTimeAgo(lastRefreshed)}</span>
                <button
                  onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    autoRefreshEnabled 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}
                  title={autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
                >
                  {autoRefreshEnabled ? 'Auto' : 'Manual'}
                </button>
              </div>
            </div>
          </div>

          {!hasInfuraKey && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Infura API Key Required</h3>
                <p className="mt-1 text-sm text-yellow-600">
                  An Infura API key is required to generate wallets. Please add an Infura API key to the database first.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">Select Network</h2>
              <NetworkSelector
                networks={networks}
                selectedNetwork={selectedNetwork}
                onNetworkSelect={setSelectedNetwork}
              />
              <p className="mt-4 text-sm text-gray-600">
                Note: Only Ethereum, Polygon, Arbitrum, Linea, and Base networks are supported through Infura.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">Generate Wallets</h2>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label htmlFor="walletCount" className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Wallets
                  </label>
                  <input
                    type="number"
                    id="walletCount"
                    min="1"
                    max="1000"
                    value={walletCount}
                    onChange={(e) => setWalletCount(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <button
                  onClick={handleGenerateWallets}
                  disabled={isGenerating || !isConnected || !selectedNetwork || !hasInfuraKey}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed h-10"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Generating...
                    </>
                  ) : (
                    'Generate Wallets'
                  )}
                </button>
              </div>
            </div>
          </div>

          {!isConnected && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-600">
                Please connect to Supabase first using the "Connect to Supabase" button in the top right.
              </p>
            </div>
          )}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Wallets"
            value={stats.totalWallets}
            icon={WalletIcon}
          />
          <StatsCard
            title="Connected"
            value={stats.connectedWallets}
            icon={Activity}
          />
          <StatsCard
            title="Minting"
            value={stats.mintingWallets}
            icon={BarChart3}
          />
          <StatsCard
            title="Completed"
            value={stats.completedWallets}
            icon={CheckCircle}
          />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl font-semibold">Recent Wallets</h2>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search address or tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-64"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filterNetwork}
                  onChange={(e) => setFilterNetwork(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Networks</option>
                  {networks.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.name}
                    </option>
                  ))}
                </select>
                
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Status</option>
                  <option value="created">Created</option>
                  <option value="connected">Connected</option>
                  <option value="minting">Minting</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    {/* Empty header for connection status */}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wallet Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Network
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Explorer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tag
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentWallets.map((wallet) => (
                  <tr key={wallet.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ConnectionStatus 
                        walletId={wallet.id}
                        onStatusChange={(isConnected) => {
                          if (!isConnected) {
                            refreshData();
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-gray-900">
                          {formatAddress(wallet.address)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(wallet.address)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy address"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedWalletId(wallet.id);
                            setIsReownModalOpen(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 transition-colors"
                          title="Connect with WalletConnect"
                        >
                          <WalletIcon className="w-4 h-4" />
                        </button>
                        {copiedAddress === wallet.address && (
                          <span className="text-xs text-green-600">Copied!</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {wallet.network}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(wallet.status)}`}>
                        {wallet.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(wallet.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {wallet.network && getExplorerUrl(wallet.network, wallet.address) && (
                        <a
                          href={getExplorerUrl(wallet.network, wallet.address)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900"
                          title="View on explorer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingTag?.id === wallet.id ? (
                        <div className="flex items-center space-x-2 min-w-[200px]">
                          <input
                            type="text"
                            value={editingTag.tag}
                            onChange={(e) => setEditingTag({ ...editingTag, tag: e.target.value })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleTagUpdate(wallet.id, editingTag.tag);
                              } else if (e.key === 'Escape') {
                                setEditingTag(null);
                              }
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleTagUpdate(wallet.id, editingTag.tag)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 min-w-[200px]">
                          <span className="text-sm text-gray-900 truncate">{wallet.tag || '-'}</span>
                          <button
                            onClick={() => setEditingTag({ id: wallet.id, tag: wallet.tag || '' })}
                            className="text-gray-400 hover:text-gray-600"
                            title="Edit tag"
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isLoading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center items-center mt-4">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          )}
        </div>
      </div>
      <ReownModal
        isOpen={isReownModalOpen}
        onClose={() => {
          setIsReownModalOpen(false);
          setSelectedWalletId(null);
        }}
        onConnect={handleWalletConnect}
        isConnecting={isConnecting}
        walletId={selectedWalletId}
      />
    </div>
  );
}

export default Dashboard;