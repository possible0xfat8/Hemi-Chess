import { getBackendUrl } from '@/lib/config'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'
import { LogOut, Wallet } from 'lucide-react'

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

  const handleConnect = async (walletConnector: typeof connectors[0]) => {
    try {
      console.log('[Wallet] Connecting to:', walletConnector.name)
      await connect({ connector: walletConnector })
    } catch (error) {
      console.error('[Wallet] Connection error:', error)
    }
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

  // Close connector menu when clicking outside
  useEffect(() => {
    if (!showConnectors) return
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-wallet-menu]')) {
        setShowConnectors(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showConnectors])

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Disconnect button */}
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="flex items-center justify-center gap-2 h-9 w-9 md:h-10 md:w-auto md:px-4 bg-red-600/80 hover:bg-red-600 disabled:bg-red-800/60 disabled:cursor-not-allowed border border-red-500/50 rounded-lg font-semibold text-sm transition-all"
          title="Disconnect Wallet"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="relative" data-wallet-menu>
      <button
        onClick={() => setShowConnectors((open) => !open)}
        disabled={isPending}
        className="flex items-center justify-center gap-2 h-9 w-9 md:h-10 md:w-auto md:px-5 bg-orange hover:bg-orange/90 disabled:bg-orange/60 disabled:cursor-not-allowed border border-orange/40 text-canvas rounded-lg text-sm font-semibold transition-all shadow-lg"
        title="Connect Wallet"
        aria-label="Connect Wallet"
      >
        <Wallet className="w-4 h-4 shrink-0" />
        <span className="hidden md:inline">
          {isPending ? 'Connecting…' : 'Connect Wallet'}
        </span>
      </button>

      {showConnectors && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setShowConnectors(false)}
          />
          
          {/* Menu */}
          <div className="surface absolute right-0 top-full z-[110] mt-2 w-64 p-2 border border-line shadow-2xl">
            <div className="mb-2 px-3 py-2 border-b border-line">
              <p className="text-xs font-semibold text-ink">Choose Wallet</p>
              <p className="text-[10px] text-ink-muted mt-0.5">Connect to Hemi Network</p>
            </div>
            
            {uniqueConnectors.length === 0 && (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-ink-muted">No wallets detected</p>
                <p className="text-[10px] text-ink-faint mt-1">Install MetaMask or use WalletConnect</p>
              </div>
            )}
            
            {uniqueConnectors.map((walletConnector) => (
              <button
                key={walletConnector.uid}
                onClick={() => handleConnect(walletConnector)}
                disabled={isPending}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-orange-soft hover:text-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Wallet className="w-4 h-4 shrink-0" />
                <span>{walletConnector.name}</span>
              </button>
            ))}
            
            {connectError && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-400 font-medium">Connection Failed</p>
                <p className="text-[10px] text-red-300/80 mt-1">
                  {connectError.message.includes('User rejected') || connectError.message.includes('User denied')
                    ? 'You rejected the connection request'
                    : connectError.message.includes('Provider not found')
                    ? 'Wallet not found. Please install the wallet extension or use WalletConnect'
                    : connectError.message}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

