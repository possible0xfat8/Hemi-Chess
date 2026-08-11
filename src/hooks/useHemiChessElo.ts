import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits } from 'viem'
import { HEMI_CHESS_ELO_ADDRESS, HEMI_CHESS_ELO_ABI } from '@/contracts/HemiChessElo'
import { hemiSepolia } from '@/lib/web3/config'

/**
 * Hook for interacting with HemiChessElo smart contract
 * 
 * This hook provides:
 * - Reading player's on-chain $HELO balance
 * - Checking if player has claimed starting Elo
 * - Claiming starting Elo (one-time)
 * 
 * Elo adjustments are handled by backend oracle (not player-initiated)
 */
export function useHemiChessElo() {
  const { address, isConnected } = useAccount()

  // Read ELO balance
  const { data: balanceData, isLoading: isLoadingBalance, refetch: refetchBalance } = useReadContract({
    address: HEMI_CHESS_ELO_ADDRESS,
    abi: HEMI_CHESS_ELO_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: hemiSepolia.id,
    query: {
      enabled: isConnected && !!address,
    },
  })

  // Read claim status
  const { data: hasClaimedData, isLoading: isLoadingClaimed, refetch: refetchClaimed } = useReadContract({
    address: HEMI_CHESS_ELO_ADDRESS,
    abi: HEMI_CHESS_ELO_ABI,
    functionName: 'hasClaimed',
    args: address ? [address] : undefined,
    chainId: hemiSepolia.id,
    query: {
      enabled: isConnected && !!address,
    },
  })

  // Write: Claim ELO
  const {
    writeContract,
    data: claimHash,
    isPending: isClaimPending,
    error: claimError,
  } = useWriteContract()

  // Wait for claim transaction confirmation
  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  })

  // Format balance from wei to standard ELO units (with fallback for safety)
  const eloBalance = balanceData ? formatUnits(balanceData, 18) : '0'
  
  // Numeric Elo for calculations (defaults to 0 if not available)
  const eloRating = balanceData ? Math.floor(Number(formatUnits(balanceData, 18))) : 0

  // Claim ELO function
  const claimElo = () => {
    if (!isConnected || !address) {
      console.error('[ELO] Wallet not connected')
      return
    }

    writeContract({
      address: HEMI_CHESS_ELO_ADDRESS,
      abi: HEMI_CHESS_ELO_ABI,
      functionName: 'claimElo',
      chainId: hemiSepolia.id,
    })
  }

  // Refetch all data
  const refetchAll = () => {
    refetchBalance()
    refetchClaimed()
  }

  return {
    // Data (with safe fallbacks)
    eloBalance, // String formatted balance
    eloRating,  // Numeric rating (0 if not available)
    isClaimed: hasClaimedData ?? false,
    isConnected,
    address,
    
    // Loading states
    isLoadingBalance,
    isLoadingClaimed,
    isClaimPending,
    isClaimConfirming,
    
    // Success states
    isClaimSuccess,
    
    // Functions
    claimElo,
    refetchAll,
    
    // Errors
    claimError,
    
    // Transaction hash
    claimHash,
  }
}

/**
 * Alias for useHemiChessElo for better semantics
 * Use this when you specifically want player stats/Elo data
 */
export const usePlayerStats = useHemiChessElo
