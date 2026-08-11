/**
 * Match Settlement Service - Backend Oracle
 * 
 * Prevents rage-quitting exploits by:
 * 1. Having both players sign match results off-chain (EIP-712)
 * 2. Backend verifies both signatures
 * 3. Backend calls adjustElo() on smart contract
 * 4. Loser NEVER signs a transaction to burn their tokens
 */

const { createPublicClient, createWalletClient, http, parseUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { calculateMatchElo, getAbsoluteEloDelta } = require('./eloMath');

// Hemi Sepolia configuration
const HEMI_SEPOLIA = {
  id: 743111,
  name: 'Hemi Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.rpc.hemi.network/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Hemi Explorer', url: 'https://testnet.explorer.hemi.network' },
  },
  testnet: true,
};

// Contract configuration
const HEMI_CHESS_ELO_ADDRESS = process.env.HEMI_CHESS_ELO_ADDRESS || '0xeE82E97e9B8bA9b189FcB7Dedb65Dc3717f41d79';
const HEMI_CHESS_ELO_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'bool', name: 'isWin', type: 'bool' },
    ],
    name: 'adjustElo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'players', type: 'address[]' },
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
      { internalType: 'bool[]', name: 'isWins', type: 'bool[]' },
    ],
    name: 'batchAdjustElo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// EIP-712 domain and types (must match frontend)
const EIP712_DOMAIN = {
  name: 'HemiChess',
  version: '1',
  chainId: HEMI_SEPOLIA.id,
  verifyingContract: HEMI_CHESS_ELO_ADDRESS,
};

const EIP712_TYPES = {
  MatchResult: [
    { name: 'gameId', type: 'string' },
    { name: 'winner', type: 'address' },
    { name: 'loser', type: 'address' },
    { name: 'fenString', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

/**
 * Initialize blockchain clients
 * 
 * @returns {{ publicClient: any, walletClient: any | null, account: any | null }}
 */
function initializeClients() {
  // Public client for reading blockchain state
  const publicClient = createPublicClient({
    chain: HEMI_SEPOLIA,
    transport: http(),
  });

  // Wallet client for signing transactions (backend oracle)
  let walletClient = null;
  let account = null;

  // Check if backend private key is configured
  const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY;
  if (backendPrivateKey && backendPrivateKey !== '') {
    try {
      account = privateKeyToAccount(backendPrivateKey);
      walletClient = createWalletClient({
        account,
        chain: HEMI_SEPOLIA,
        transport: http(),
      });
      console.log('[SETTLEMENT] ✓ Backend oracle wallet initialized:', account.address);
    } catch (err) {
      console.error('[SETTLEMENT] ⚠ Failed to initialize backend wallet:', err.message);
    }
  } else {
    console.log('[SETTLEMENT] ⚠ BACKEND_PRIVATE_KEY not set - settlement disabled');
    console.log('[SETTLEMENT] ⚠ Add BACKEND_PRIVATE_KEY to backend/.env to enable on-chain settlement');
  }

  return { publicClient, walletClient, account };
}

// Initialize clients
const { publicClient, walletClient, account } = initializeClients();

/**
 * Verify EIP-712 signature
 * 
 * @param {object} matchData - Match result data
 * @param {string} signature - Signature hex string
 * @param {string} expectedSigner - Expected signer address
 * @returns {Promise<boolean>} True if signature is valid
 */
async function verifyMatchSignature(matchData, signature, expectedSigner) {
  try {
    const { verifyTypedData } = require('viem');
    
    const isValid = await verifyTypedData({
      address: expectedSigner,
      domain: EIP712_DOMAIN,
      types: EIP712_TYPES,
      primaryType: 'MatchResult',
      message: matchData,
      signature,
    });

    return isValid;
  } catch (err) {
    console.error('[SETTLEMENT] Signature verification failed:', err);
    return false;
  }
}

/**
 * Read current Elo balance from smart contract
 * 
 * @param {string} playerAddress - Player wallet address
 * @returns {Promise<bigint>} Current Elo balance in wei
 */
async function readEloBalance(playerAddress) {
  try {
    const balance = await publicClient.readContract({
      address: HEMI_CHESS_ELO_ADDRESS,
      abi: HEMI_CHESS_ELO_ABI,
      functionName: 'balanceOf',
      args: [playerAddress],
    });
    return balance;
  } catch (err) {
    console.error(`[SETTLEMENT] Failed to read balance for ${playerAddress}:`, err.message);
    return 0n;
  }
}

/**
 * Call adjustElo on smart contract
 * 
 * @param {string} playerAddress - Player address
 * @param {number} delta - Absolute Elo change amount
 * @param {boolean} isWin - True for mint, false for burn
 * @returns {Promise<{ success: boolean, txHash?: string, error?: string }>}
 */
async function adjustEloOnChain(playerAddress, delta, isWin) {
  if (!walletClient || !account) {
    return {
      success: false,
      error: 'Backend wallet not configured',
    };
  }

  try {
    // Convert delta to wei (18 decimals)
    const amount = parseUnits(delta.toString(), 18);

    console.log(`[SETTLEMENT] Calling adjustElo(${playerAddress}, ${delta} $HELO, ${isWin ? 'MINT' : 'BURN'})`);

    // Get current gas price with 50% buffer (increased from 20%)
    const gasPrice = await publicClient.getGasPrice();
    const adjustedGasPrice = (gasPrice * 150n) / 100n; // 50% higher than current
    
    console.log(`[SETTLEMENT] Gas price: ${adjustedGasPrice.toString()} wei (50% buffer)`);

    // Simulate the transaction first
    const { request } = await publicClient.simulateContract({
      account,
      address: HEMI_CHESS_ELO_ADDRESS,
      abi: HEMI_CHESS_ELO_ABI,
      functionName: 'adjustElo',
      args: [playerAddress, amount, isWin],
      gasPrice: adjustedGasPrice,
    });

    // Execute the transaction with proper gas settings
    const txHash = await walletClient.writeContract({
      ...request,
      gasPrice: adjustedGasPrice,
    });
    console.log(`[SETTLEMENT] ✓ Transaction submitted: ${txHash}`);

    // Wait for confirmation with extended timeout (Hemi Sepolia can be slow)
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 300_000, // 5 minutes timeout (increased from 2)
      });
      console.log(`[SETTLEMENT] ✓ Transaction confirmed in block ${receipt.blockNumber}`);
    } catch (waitErr) {
      // Transaction was submitted but confirmation timed out
      // This is OK - the transaction will eventually confirm
      console.log(`[SETTLEMENT] ⚠ Transaction ${txHash} submitted but confirmation timed out after 5 minutes`);
      console.log(`[SETTLEMENT] ⚠ Check status at: https://testnet.explorer.hemi.xyz/tx/${txHash}`);
    }

    // Return success since transaction was submitted
    return {
      success: true,
      txHash,
    };
  } catch (err) {
    console.error('[SETTLEMENT] adjustElo transaction failed:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Batch adjust ELO for multiple players in a single transaction
 * 
 * @param {Array<{address: string, delta: number, isWin: boolean}>} adjustments - Array of adjustments
 * @returns {Promise<{ success: boolean, txHash?: string, error?: string }>}
 */
async function batchAdjustEloOnChain(adjustments) {
  if (!walletClient || !account) {
    return {
      success: false,
      error: 'Backend wallet not configured',
    };
  }

  if (!adjustments || adjustments.length === 0) {
    return {
      success: false,
      error: 'No adjustments provided',
    };
  }

  try {
    // Prepare batch arrays
    const players = adjustments.map(adj => adj.address);
    const amounts = adjustments.map(adj => parseUnits(adj.delta.toString(), 18));
    const isWins = adjustments.map(adj => adj.isWin);

    console.log(`[SETTLEMENT] Calling batchAdjustElo for ${players.length} players`);
    adjustments.forEach(adj => {
      console.log(`[SETTLEMENT]   ${adj.address.slice(0, 8)}... ${adj.isWin ? 'MINT' : 'BURN'} ${adj.delta}`);
    });

    // Get current gas price with 50% buffer
    const gasPrice = await publicClient.getGasPrice();
    const adjustedGasPrice = (gasPrice * 150n) / 100n;
    
    console.log(`[SETTLEMENT] Gas price: ${adjustedGasPrice.toString()} wei (50% buffer)`);

    // Simulate the transaction first
    const { request } = await publicClient.simulateContract({
      account,
      address: HEMI_CHESS_ELO_ADDRESS,
      abi: HEMI_CHESS_ELO_ABI,
      functionName: 'batchAdjustElo',
      args: [players, amounts, isWins],
      gasPrice: adjustedGasPrice,
    });

    // Execute the transaction
    const txHash = await walletClient.writeContract({
      ...request,
      gasPrice: adjustedGasPrice,
    });
    console.log(`[SETTLEMENT] ✓ Batch transaction submitted: ${txHash}`);

    // Wait for confirmation
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 300_000, // 5 minutes
      });
      console.log(`[SETTLEMENT] ✓ Batch transaction confirmed in block ${receipt.blockNumber}`);
    } catch (waitErr) {
      console.log(`[SETTLEMENT] ⚠ Batch transaction ${txHash} submitted but confirmation timed out`);
      console.log(`[SETTLEMENT] ⚠ Check status at: https://testnet.explorer.hemi.xyz/tx/${txHash}`);
    }

    return {
      success: true,
      txHash,
    };
  } catch (err) {
    console.error('[SETTLEMENT] batchAdjustElo transaction failed:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Settle a match on-chain (Backend Oracle function)
 * 
 * @param {object} params - Settlement parameters
 * @param {string} params.gameId - Game identifier
 * @param {string} params.whiteAddress - White player address
 * @param {string} params.blackAddress - Black player address
 * @param {number} params.whiteElo - White player current Elo
 * @param {number} params.blackElo - Black player current Elo
 * @param {'white' | 'black' | 'draw'} params.winner - Game result
 * @param {string} params.fenString - Final board position
 * @param {string} params.whiteSignature - White player's signature
 * @param {string} params.blackSignature - Black player's signature
 * @param {number} params.timestamp - Match end timestamp
 * @returns {Promise<{ success: boolean, whiteResult?: any, blackResult?: any, error?: string }>}
 */
async function settleMatch({
  gameId,
  whiteAddress,
  blackAddress,
  whiteElo,
  blackElo,
  winner,
  fenString,
  whiteSignature,
  blackSignature,
  timestamp,
}) {
  console.log(`\n[SETTLEMENT] ========== Processing Match ${gameId} ==========`);
  console.log(`[SETTLEMENT] White: ${whiteAddress} (${whiteElo} Elo)`);
  console.log(`[SETTLEMENT] Black: ${blackAddress} (${blackElo} Elo)`);
  console.log(`[SETTLEMENT] Result: ${winner}`);

  // Step 1: Build match data for signature verification
  const matchData = {
    gameId,
    winner: winner === 'white' ? whiteAddress : (winner === 'black' ? blackAddress : '0x0000000000000000000000000000000000000000'),
    loser: winner === 'white' ? blackAddress : (winner === 'black' ? whiteAddress : '0x0000000000000000000000000000000000000000'),
    fenString,
    timestamp: BigInt(timestamp),
  };

  // Step 2: Verify both signatures
  console.log('[SETTLEMENT] Verifying signatures...');
  
  const whiteSignatureValid = await verifyMatchSignature(matchData, whiteSignature, whiteAddress);
  const blackSignatureValid = await verifyMatchSignature(matchData, blackSignature, blackAddress);

  if (!whiteSignatureValid) {
    console.error('[SETTLEMENT] ✗ White player signature invalid');
    return { success: false, error: 'Invalid white player signature' };
  }

  if (!blackSignatureValid) {
    console.error('[SETTLEMENT] ✗ Black player signature invalid');
    return { success: false, error: 'Invalid black player signature' };
  }

  console.log('[SETTLEMENT] ✓ Both signatures verified');

  // Step 3: Calculate Elo changes
  const eloChanges = calculateMatchElo(whiteElo, blackElo, winner);
  console.log(`[SETTLEMENT] Elo Changes - White: ${eloChanges.white.change >= 0 ? '+' : ''}${eloChanges.white.change}, Black: ${eloChanges.black.change >= 0 ? '+' : ''}${eloChanges.black.change}`);

  // Step 4: Call adjustElo for both players
  const whiteDelta = getAbsoluteEloDelta(eloChanges.white.change);
  const blackDelta = getAbsoluteEloDelta(eloChanges.black.change);

  let whiteResult, blackResult;

  if (whiteDelta > 0) {
    whiteResult = await adjustEloOnChain(whiteAddress, whiteDelta, eloChanges.white.change > 0);
  } else {
    whiteResult = { success: true, txHash: null }; // No change needed
  }

  if (blackDelta > 0) {
    blackResult = await adjustEloOnChain(blackAddress, blackDelta, eloChanges.black.change > 0);
  } else {
    blackResult = { success: true, txHash: null }; // No change needed
  }

  // Step 5: Return results
  if (whiteResult.success && blackResult.success) {
    console.log('[SETTLEMENT] ✓ Match settlement complete');
    
    // NOTE: the database record is written by the caller (server.js
    // handleGameSettlement) BEFORE the chain call, so it is not repeated here.
    // recordMatchResult is idempotent per gameId, but keeping a single writer
    // avoids double-counting W/L/D stats entirely.
    

    
    console.log('[SETTLEMENT] ==========================================\n');
    return {
      success: true,
      whiteResult: {
        oldElo: whiteElo,
        newElo: eloChanges.white.newRating,
        change: eloChanges.white.change,
        txHash: whiteResult.txHash,
      },
      blackResult: {
        oldElo: blackElo,
        newElo: eloChanges.black.newRating,
        change: eloChanges.black.change,
        txHash: blackResult.txHash,
      },
    };
  } else {
    console.error('[SETTLEMENT] ✗ Settlement failed');
    return {
      success: false,
      error: 'One or more transactions failed',
      whiteResult,
      blackResult,
    };
  }
}

/**
 * Check if settlement is enabled
 * 
 * @returns {boolean}
 */
function isSettlementEnabled() {
  return walletClient !== null && account !== null;
}

module.exports = {
  settleMatch,
  readEloBalance,
  adjustEloOnChain,
  batchAdjustEloOnChain,
  isSettlementEnabled,
  getOracleAddress: () => account?.address || null,
};
