import { useAccount, useSignTypedData } from 'wagmi'
import { hemiSepolia } from '@/lib/web3/config'
import { HEMI_CHESS_ELO_ADDRESS } from '@/contracts/HemiChessElo'

/**
 * EIP-712 typed data domain for match result signatures
 * This ensures signatures are specific to our contract and chain
 */
const domain = {
  name: 'HemiChess',
  version: '1',
  chainId: hemiSepolia.id,
  verifyingContract: HEMI_CHESS_ELO_ADDRESS,
} as const

/**
 * EIP-712 types for match result
 * Both players sign this to prove they agree on the final game state
 */
const types = {
  MatchResult: [
    { name: 'gameId', type: 'string' },
    { name: 'winner', type: 'address' },
    { name: 'loser', type: 'address' },
    { name: 'fenString', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const

export interface MatchResultData {
  gameId: string
  winner: `0x${string}`
  loser: `0x${string}`
  fenString: string
  timestamp: bigint
}

/**
 * Hook for signing match results with EIP-712
 * 
 * This prevents rage-quitting exploits by having both players
 * cryptographically sign the final game state off-chain.
 * 
 * The backend oracle then verifies both signatures before
 * calling adjustElo() on the smart contract.
 */
export function useMatchSignature() {
  const { address, isConnected } = useAccount()
  const { signTypedDataAsync, isPending, error } = useSignTypedData()

  /**
   * Sign a match result
   * 
   * @param matchData - Game ID, winner/loser addresses, final FEN, and timestamp
   * @returns The signature hex string
   */
  const signMatchResult = async (matchData: MatchResultData): Promise<`0x${string}`> => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected')
    }

    try {
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'MatchResult',
        message: matchData,
      })

      console.log('[SIGNATURE] Match result signed by', address)
      return signature
    } catch (err) {
      console.error('[SIGNATURE] Failed to sign match result:', err)
      throw err
    }
  }

  return {
    signMatchResult,
    isSigningPending: isPending,
    signError: error,
    isConnected,
    address,
  }
}

/**
 * Create a match result data object from game state
 * 
 * @param gameId - Unique game identifier
 * @param winnerAddress - Winner's wallet address
 * @param loserAddress - Loser's wallet address  
 * @param fenString - Final board position in FEN notation
 * @returns Formatted match result data for signing
 */
export function createMatchResultData(
  gameId: string,
  winnerAddress: `0x${string}`,
  loserAddress: `0x${string}`,
  fenString: string
): MatchResultData {
  return {
    gameId,
    winner: winnerAddress,
    loser: loserAddress,
    fenString,
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
  }
}
