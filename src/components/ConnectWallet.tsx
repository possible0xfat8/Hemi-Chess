import { getBackendUrl } from '@/lib/config'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'
import { User, LogOut } from 'lucide-react'

export function ConnectWallet() {
  const { address, isConnected, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect, connectors, error: connectError, isPending } = useConnect()
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [showConnectors, setShowConnectors] = useState(false)

  // EIP-6963 discovery can surface the same wallet twice; show one entry per name
  const uniqueConnectors = connectors.filter(
    (c, i, arr) => arr.findIndex((o) => o.name === c.name) === i,
  )

  // Sync wallet connection with backend
  useEffect(() => {
    if (isConnected && address && !isDisconnecting) {
      syncWalletWithBackend(address)
      setShowConnectors(false)
    }
  }, [isConnected, address, isDisconnecting])

  const syncWalletWithBackend = async (walletAddress: string) => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletAddress.toLowerCase() }),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[Wallet] Synced with backend:', data)
      }
    } catch (err) {
      console.error('[Wallet] Failed to sync with backend:', err)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true)
      console.log('[Wallet] Disconnecting...')
      
      // Disconnect from the connector properly
      if (connector) {
        console.log('[Wallet] Disconnecting connector:', connector.name)
        await disconnect({ connector })
      } else {
        await disconnect()
      }
      
      // Wait a moment for disconnect to complete
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Clear AppKit/WalletConnect session storage
      if (typeof window !== 'undefined') {
        console.log('[Wallet] Clearing session storage...')
        
        // Get all keys first to avoid iterator issues
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) keysToRemove.push(key)
        }
        
        // Remove wallet-related keys
        keysToRemove.forEach(key => {
          if (
            key.includes('wc@2') ||
            key.includes('walletconnect') ||
            key.includes('@w3m') ||
            key.includes('W3M') ||
            key.includes('reown') ||
            key.includes('REOWN') ||
            key.includes('wagmi.') ||
            key.includes('appkit')
          ) {
            console.log('[Wallet] Removing key:', key)
            localStorage.removeItem(key)
          }
        })
        
        // Clear session storage
        const sessionKeys: string[] = []
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key) sessionKeys.push(key)
        }
        
        sessionKeys.forEach(key => {
          if (
            key.includes('wc@2') ||
            key.includes('walletconnect') ||
            key.includes('@w3m') ||
            key.includes('reown') ||
            key.includes('wagmi')
          ) {
            sessionStorage.removeItem(key)
          }
        })
      }
      
      console.log('[Wallet] Disconnect complete, reloading page...')
      
      // CRITICAL: Reload page to reset AppKit instance
      setTimeout(() => {
        window.location.reload()
      }, 500)
      
    } catch (error) {
      console.error('[Wallet] Disconnect error:', error)
      setIsDisconnecting(false)
    }
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Disconnect button */}
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="flex items-center justify-center gap-2 h-10 px-3 sm:px-4 bg-red-600/80 hover:bg-red-600 disabled:bg-red-800/60 disabled:cursor-not-allowed border border-red-500/50 rounded-lg font-semibold text-sm transition-all"
          title="Disconnect"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowConnectors((open) => !open)}
        className="flex items-center justify-center gap-2 h-10 px-3 sm:px-5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-all shadow-md"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">
          {isPending ? 'Connecting…' : 'Connect Wallet'}
        </span>
      </button>
      {showConnectors && (
        <div className="surface-modal absolute right-0 top-full z-[110] mt-2 w-56 p-2">
          {uniqueConnectors.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">No wallets detected</p>
          )}
          {uniqueConnectors.map((walletConnector) => (
            <button
              key={walletConnector.uid}
              onClick={() => connect({ connector: walletConnector })}
              disabled={isPending}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-orange-soft disabled:opacity-50"
            >
              {walletConnector.name}
            </button>
          ))}
          {connectError && (
            <p className="px-3 py-2 text-xs text-danger-accent">
              {connectError.message.includes('Provider not found')
                ? 'That wallet extension was not detected in this browser. Install it, or use WalletConnect to scan a QR code from your phone.'
                : connectError.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
