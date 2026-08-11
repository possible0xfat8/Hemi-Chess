import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getBackendUrl } from '@/lib/config';
import { Loader2, RefreshCw, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

interface SyncStatus {
  address: string;
  onChainElo: number;
  databaseElo: number;
  totalGames: number;
  inSync: boolean;
  difference: number;
  needsSync: boolean;
  direction?: 'mint' | 'burn' | 'none';
  error?: string;
}

interface SyncResponse {
  settlementEnabled: boolean;
  tolerance: number;
  oracleWallet: {
    address: string;
    balance: string;
    lowBalance: boolean;
  };
  playerSync: SyncStatus[];
  needsSyncCount: number;
  totalPlayers: number;
  timestamp: string;
}

export function BlockchainSyncPanel() {
  const { address: adminWallet } = useAccount();
  const [syncData, setSyncData] = useState<SyncResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<any>(null);

  const fetchSyncStatus = async () => {
    if (!adminWallet) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getBackendUrl()}/admin/blockchain-sync?adminWallet=${adminWallet}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }

      const data = await response.json();
      setSyncData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncPlayers = async (addresses: string[]) => {
    if (!adminWallet || addresses.length === 0) return;

    setSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${getBackendUrl()}/admin/blockchain-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses, adminWallet }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const data = await response.json();
      setSyncResults(data);
      
      // Refresh status after sync
      setTimeout(() => {
        fetchSyncStatus();
        setSyncResults(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const syncAll = () => {
    if (!syncData) return;
    const needsSyncAddresses = syncData.playerSync
      .filter(p => p.needsSync)
      .map(p => p.address);
    syncPlayers(needsSyncAddresses);
  };

  useEffect(() => {
    fetchSyncStatus();
  }, [adminWallet]);

  if (!adminWallet) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <p className="text-slate-400">Connect your admin wallet to view sync status</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Blockchain Sync Status</h2>
          <p className="text-sm text-slate-400">Monitor ELO sync between database and blockchain</p>
        </div>
        <button
          onClick={fetchSyncStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {syncData && !syncData.settlementEnabled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400">
          On-chain settlement is disabled (BACKEND_PRIVATE_KEY is not configured). Ratings are still
          safe in the database and will sync once the oracle wallet is set up.
        </div>
      )}

      {/* Oracle Wallet Status */}
      {syncData?.oracleWallet && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Oracle Wallet</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Address</p>
              <p className="text-sm font-mono">{syncData.oracleWallet.address.slice(0, 10)}...{syncData.oracleWallet.address.slice(-8)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Balance</p>
              <p className={`text-sm font-semibold ${syncData.oracleWallet.lowBalance ? 'text-red-400' : 'text-teal'}`}>
                {syncData.oracleWallet.balance}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {syncData && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Total Players</p>
            <p className="text-2xl font-bold">{syncData.totalPlayers}</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">In Sync</p>
            <p className="text-2xl font-bold text-teal">
              {syncData.totalPlayers - syncData.needsSyncCount}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Needs Sync</p>
            <p className="text-2xl font-bold text-orange">
              {syncData.needsSyncCount}
            </p>
          </div>
        </div>
      )}

      {/* Sync All Button */}
      {syncData && syncData.needsSyncCount > 0 && (
        <button
          onClick={syncAll}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange to-teal hover:from-orange/90 hover:to-teal/90 text-slate-950 font-bold rounded-xl transition-all disabled:opacity-50"
        >
          {syncing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Syncing {syncData.needsSyncCount} players...
            </>
          ) : (
            <>
              <TrendingUp className="w-5 h-5" />
              Sync All ({syncData.needsSyncCount})
            </>
          )}
        </button>
      )}

      {/* Sync Results */}
      {syncResults && (
        <div className="bg-teal/10 border border-teal/30 rounded-xl p-4">
          <p className="text-teal font-semibold mb-2">{syncResults.message}</p>
          <div className="text-sm text-slate-400">
            <p>Synced: {syncResults.summary.synced}</p>
            <p>Skipped: {syncResults.summary.skipped}</p>
            <p>Failed: {syncResults.summary.failed}</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Players List */}
      {syncData && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/60 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Address</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Games</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Database ELO</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Blockchain ELO</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Difference</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {syncData.playerSync.map((player) => (
                  <tr key={player.address} className="hover:bg-slate-950/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-mono">{player.address.slice(0, 8)}...{player.address.slice(-6)}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-sm">{player.totalGames}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-semibold">{player.databaseElo || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-semibold">{player.onChainElo || 0}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className={`text-sm font-semibold ${
                        player.inSync ? 'text-slate-400' :
                        player.difference > 0 ? 'text-orange' :
                        'text-red-400'
                      }`}>
                        {player.difference !== null ? (player.difference > 0 ? '+' : '') + player.difference : '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {player.error ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          Error
                        </span>
                      ) : player.inSync ? (
                        <span className="inline-flex items-center gap-1 text-xs text-teal">
                          <CheckCircle className="w-3 h-3" />
                          Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-orange">
                          <AlertCircle className="w-3 h-3" />
                          {player.direction === 'burn' ? 'Burn needed' : 'Mint needed'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {player.needsSync && (
                        <button
                          onClick={() => syncPlayers([player.address])}
                          disabled={syncing}
                          className="px-3 py-1 bg-orange/20 hover:bg-orange/30 text-orange text-xs font-semibold rounded border border-orange/30 transition-all disabled:opacity-50"
                        >
                          Sync
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && !syncData && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}
    </div>
  );
}
