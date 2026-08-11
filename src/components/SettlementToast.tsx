import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { getSocket } from '@/lib/socket'

interface Settlement {
  id: string
  status: 'pending' | 'complete' | 'error'
  message: string
  change?: number
  timestamp: number
}

export function SettlementToast() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const { address } = useAccount()

  useEffect(() => {
    const socket = getSocket()

    // Listen for settlement events globally
    const handleSettlementPending = () => {
      const id = `settlement-${Date.now()}`
      setSettlements(prev => [...prev, {
        id,
        status: 'pending',
        message: 'Processing on-chain settlement...',
        timestamp: Date.now(),
      }])
    }

    const handleSettlementComplete = ({ whiteResult, blackResult }: any) => {
      if (!address) return

      // Determine which result belongs to the current user
      // This is a simplified approach - ideally we'd track this per game
      const myResult = whiteResult || blackResult
      const change = myResult?.change || 0
      const oldElo = myResult?.oldElo || 0
      const newElo = myResult?.newElo || 0

      // Update the most recent pending settlement
      setSettlements(prev => {
        const pending = prev.find(s => s.status === 'pending')
        if (pending) {
          return prev.map(s => 
            s.id === pending.id
              ? {
                  ...s,
                  status: 'complete',
                  message: `Settlement complete! ${change >= 0 ? '+' : ''}${change} $HELO (${oldElo} → ${newElo})`,
                  change,
                }
              : s
          )
        }
        return prev
      })

      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        setSettlements(prev => {
          const completedIds = prev.filter(s => s.status === 'complete' && Date.now() - s.timestamp >= 6000).map(s => s.id)
          return prev.filter(s => !completedIds.includes(s.id))
        })
      }, 6000)
    }

    const handleSettlementError = ({ error }: any) => {
      // Update the most recent pending settlement
      setSettlements(prev => {
        const pending = prev.find(s => s.status === 'pending')
        if (pending) {
          return prev.map(s => 
            s.id === pending.id
              ? {
                  ...s,
                  status: 'error',
                  message: `Settlement failed: ${error}`,
                }
              : s
          )
        }
        return prev
      })

      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setSettlements(prev => {
          const errorIds = prev.filter(s => s.status === 'error' && Date.now() - s.timestamp >= 8000).map(s => s.id)
          return prev.filter(s => !errorIds.includes(s.id))
        })
      }, 8000)
    }

    socket.on('settlement_pending', handleSettlementPending)
    socket.on('settlement_complete', handleSettlementComplete)
    socket.on('settlement_error', handleSettlementError)

    return () => {
      socket.off('settlement_pending', handleSettlementPending)
      socket.off('settlement_complete', handleSettlementComplete)
      socket.off('settlement_error', handleSettlementError)
    }
  }, [address])

  const dismissSettlement = (id: string) => {
    setSettlements(prev => prev.filter(s => s.id !== id))
  }

  if (settlements.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {settlements.map((settlement) => (
        <div
          key={settlement.id}
          className={`pointer-events-auto rounded-xl p-4 shadow-2xl border backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-right ${
            settlement.status === 'pending'
              ? 'bg-blue/95 border-blue/40 text-white'
              : settlement.status === 'complete'
              ? 'bg-teal/95 border-teal/40 text-white'
              : 'bg-rose-500/95 border-rose-500/40 text-white'
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {settlement.status === 'pending' && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-transparent border-t-white"></div>
              )}
              {settlement.status === 'complete' && (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {settlement.status === 'error' && (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">
                {settlement.status === 'pending' && 'Settlement processing'}
                {settlement.status === 'complete' && 'Settlement complete'}
                {settlement.status === 'error' && 'Settlement failed'}
              </p>
              <p className="text-xs mt-1 opacity-90">
                {settlement.message}
              </p>
            </div>

            {/* Close button */}
            {settlement.status !== 'pending' && (
              <button
                onClick={() => dismissSettlement(settlement.id)}
                className="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity"
                aria-label="Dismiss"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
