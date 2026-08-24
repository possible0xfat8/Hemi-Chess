/**
 * ELO <-> Blockchain reconciliation
 *
 * Single source of truth for "what should this wallet's on-chain $HELO be?".
 * Database ELO is authoritative; the chain is reconciled towards it in BOTH
 * directions (mint when chain is behind, burn when chain is ahead).
 */

const { createPublicClient, http, formatEther, isAddress, getAddress } = require('viem');
const { readEloBalance, adjustEloOnChain, batchAdjustEloOnChain, isSettlementEnabled } = require('./matchSettlement');

// Default rating every new player starts with (database + chain)
const DEFAULT_ELO = 1200;

// Ignore differences smaller than this (avoids burning gas on rounding noise)
const SYNC_TOLERANCE = 1;

const HEMI_RPC = 'https://testnet.rpc.hemi.network/rpc';
const CONTRACT_ADDRESS =
  process.env.HEMI_CHESS_ELO_ADDRESS || '0x985a8f367db07E2869c5B4C521386C3F760DB765';

const publicClient = createPublicClient({
  chain: {
    id: 743111,
    name: 'Hemi Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [HEMI_RPC] } },
  },
  transport: http(),
});

/**
 * Read a wallet's on-chain $HELO balance as a plain number of ELO points.
 * @param {string} walletAddress
 * @returns {Promise<number>}
 */
async function readOnChainElo(walletAddress) {
  if (!walletAddress || typeof walletAddress !== 'string' || !isAddress(walletAddress)) {
    return 0;
  }
  const balance = await readEloBalance(walletAddress);
  return Number(formatEther(balance));
}

/**
 * Compare database ELO against on-chain balance.
 *
 * @param {string} walletAddress
 * @param {number} databaseElo
 * @returns {Promise<{address:string,databaseElo:number,onChainElo:number,difference:number,inSync:boolean,needsSync:boolean}>}
 */
async function getSyncStatus(walletAddress, databaseElo) {
  if (!walletAddress || typeof walletAddress !== 'string' || !isAddress(walletAddress)) {
    return {
      address: walletAddress || 'invalid',
      databaseElo: Math.round(databaseElo ?? DEFAULT_ELO),
      onChainElo: 0,
      difference: 0,
      inSync: true,
      needsSync: false,
    };
  }

  const onChainElo = await readOnChainElo(walletAddress);
  const dbElo = Math.round(databaseElo ?? DEFAULT_ELO);
  const difference = Math.round(dbElo - onChainElo);

  return {
    address: walletAddress.toLowerCase(),
    databaseElo: dbElo,
    onChainElo: Math.round(onChainElo),
    difference,
    inSync: Math.abs(difference) <= SYNC_TOLERANCE,
    needsSync: Math.abs(difference) > SYNC_TOLERANCE,
  };
}

/**
 * Reconcile a wallet's on-chain balance with its database ELO.
 * Mints when the chain is behind, burns when the chain is ahead.
 *
 * @param {string} walletAddress
 * @param {number} databaseElo
 * @returns {Promise<{address:string,success:boolean,skipped?:boolean,onChainBefore?:number,databaseElo?:number,adjustment?:string,expectedAfter?:number,txHash?:string|null,error?:string,message?:string}>}
 */
async function reconcilePlayer(walletAddress, databaseElo) {
  if (!walletAddress || typeof walletAddress !== 'string' || !isAddress(walletAddress)) {
    return {
      address: walletAddress || 'invalid',
      success: false,
      error: `Invalid wallet address: ${walletAddress}`,
    };
  }

  if (!isSettlementEnabled()) {
    return {
      address: walletAddress.toLowerCase(),
      success: false,
      error: 'Settlement service not configured (BACKEND_PRIVATE_KEY missing)',
    };
  }

  let status;
  try {
    status = await getSyncStatus(walletAddress, databaseElo);
  } catch (err) {
    return { address: walletAddress.toLowerCase(), success: false, error: err.message };
  }

  if (!status.needsSync) {
    return {
      address: status.address,
      success: true,
      skipped: true,
      onChainElo: status.onChainElo,
      databaseElo: status.databaseElo,
      message: `Already in sync (diff ${status.difference})`,
    };
  }

  const delta = Math.abs(status.difference);
  const isMint = status.difference > 0;

  console.log(
    `[SYNC] ${status.address.slice(0, 10)}... DB=${status.databaseElo} Chain=${status.onChainElo} → ${isMint ? 'MINT' : 'BURN'} ${delta}`,
  );

  const result = await adjustEloOnChain(walletAddress, delta, isMint);

  return {
    address: status.address,
    success: result.success,
    onChainBefore: status.onChainElo,
    databaseElo: status.databaseElo,
    adjustment: `${isMint ? '+' : '-'}${delta}`,
    expectedAfter: status.databaseElo,
    txHash: result.txHash || null,
    error: result.error,
  };
}

/**
 * Reconcile multiple players in a single batch transaction
 * Much more efficient than individual reconciliation
 *
 * @param {Array<{walletAddress: string, databaseElo: number}>} players - Array of players to reconcile
 * @returns {Promise<{success: boolean, txHash?: string, adjustments?: Array, skipped?: number, error?: string}>}
 */
async function batchReconcilePlayers(players) {
  if (!isSettlementEnabled()) {
    return {
      success: false,
      error: 'Settlement service not configured (BACKEND_PRIVATE_KEY missing)',
    };
  }

  if (!players || players.length === 0) {
    return {
      success: false,
      error: 'No players provided',
    };
  }

  try {
    // Check sync status for all players and build adjustment list
    const adjustments = [];
    let skipped = 0;

    for (const { walletAddress, databaseElo } of players) {
      try {
        const status = await getSyncStatus(walletAddress, databaseElo);
        
        if (status.needsSync) {
          const delta = Math.abs(status.difference);
          const isMint = status.difference > 0;
          
          adjustments.push({
            address: walletAddress.toLowerCase(),
            delta,
            isWin: isMint,
            databaseElo: status.databaseElo,
            onChainBefore: status.onChainElo,
            difference: status.difference,
          });
          
          console.log(
            `[BATCH-SYNC] ${walletAddress.slice(0, 10)}... DB=${status.databaseElo} Chain=${status.onChainElo} → ${isMint ? 'MINT' : 'BURN'} ${delta}`
          );
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[BATCH-SYNC] Error checking ${walletAddress}:`, err.message);
      }
    }

    if (adjustments.length === 0) {
      return {
        success: true,
        skipped,
        message: `All ${skipped} players already in sync`,
      };
    }

    console.log(`[BATCH-SYNC] Submitting batch transaction for ${adjustments.length} players...`);

    // Call batch adjust on chain
    const result = await batchAdjustEloOnChain(adjustments);

    if (result.success) {
      return {
        success: true,
        txHash: result.txHash,
        adjustments: adjustments.map(adj => ({
          address: adj.address,
          adjustment: `${adj.isWin ? '+' : '-'}${adj.delta}`,
          expectedAfter: adj.databaseElo,
        })),
        skipped,
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (err) {
    console.error('[BATCH-SYNC] Batch reconciliation failed:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Fire-and-forget reconciliation (never blocks gameplay).
 * @param {string} walletAddress
 * @param {number} databaseElo
 * @param {string} [reason]
 */
function reconcileInBackground(walletAddress, databaseElo, reason = 'background') {
  setImmediate(async () => {
    try {
      const result = await reconcilePlayer(walletAddress, databaseElo);
      if (result.skipped) return;
      if (result.success) {
        console.log(
          `[SYNC] ✓ (${reason}) ${walletAddress.slice(0, 8)}... adjusted ${result.adjustment} → ${result.expectedAfter} $HELO`,
        );
      } else {
        console.error(`[SYNC] ✗ (${reason}) ${walletAddress.slice(0, 8)}...: ${result.error}`);
      }
    } catch (err) {
      console.error(`[SYNC] ✗ (${reason}) unexpected error:`, err.message);
    }
  });
}

/**
 * Oracle wallet native ETH balance (gas budget for settlements).
 * @param {string} [oracleAddress] - defaults to the configured oracle wallet
 * @returns {Promise<string>} balance in ETH
 */
async function readOracleEthBalance(oracleAddress) {
  const { getOracleAddress } = require('./matchSettlement');
  const address = oracleAddress || getOracleAddress();
  if (!address) return '0';
  try {
    const balance = await publicClient.getBalance({ address });
    return formatEther(balance);
  } catch (err) {
    console.error('[SYNC] Failed to read oracle balance:', err.message);
    return '0';
  }
}


module.exports = {
  DEFAULT_ELO,
  SYNC_TOLERANCE,
  readOnChainElo,
  getSyncStatus,
  reconcilePlayer,
  batchReconcilePlayers,
  reconcileInBackground,
  readOracleEthBalance,
};
