import { createStorage, http } from 'wagmi'
import { defineChain } from 'viem'
import { createConfig } from 'wagmi'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'

// Define Hemi Testnet (original - mainnet testnet)
export const hemiTestnet = defineChain({
  id: 743111,
  name: 'Hemi Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet.rpc.hemi.network/rpc'],
    },
    public: {
      http: ['https://testnet.rpc.hemi.network/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Hemi Explorer',
      url: 'https://testnet.explorer.hemi.xyz',
    },
  },
  testnet: true,
})

// Define Hemi Sepolia (for HemiChessElo contract)
export const hemiSepolia = defineChain({
  id: 743111, // Same chain ID as Hemi Testnet
  name: 'Hemi Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet.rpc.hemi.network/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Hemi Explorer',
      url: 'https://testnet.explorer.hemi.network',
    },
  },
  testnet: true,
})

// Get project ID from environment
const projectId = import.meta.env['VITE_WALLET_CONNECT_PROJECT_ID'] as string | undefined || 'd6959547a237d3b9ed9ca8e17468aa48'

// Validate project ID
if (!projectId || projectId === 'demo-project-id') {
  console.warn('[Wagmi Config] Using fallback WalletConnect project ID. Please set VITE_WALLET_CONNECT_PROJECT_ID in .env.local')
}

// Create custom storage that we can control
const customStorage = createStorage({
  storage: {
    getItem: (key) => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key)
      }
      return null
    },
    setItem: (key, value) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value)
      }
    },
    removeItem: (key) => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key)
      }
    },
  },
})

// Create wagmi config with WalletConnect support
export const config = createConfig({
  chains: [hemiSepolia], // Use hemiSepolia as primary chain
  connectors: [
    injected({ 
      shimDisconnect: true,
    }),
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name: 'HemiChess',
        description: 'Competitive Blockchain Chess on Hemi Network',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://hemi-chess.pages.dev/',
        icons: [typeof window !== 'undefined' ? `${window.location.origin}/hemi-chess-logo.png` : 'https://hemichess.app/hemi-chess-logo.png'],
      },
    }),
    coinbaseWallet({
      appName: 'HemiChess',
      appLogoUrl: typeof window !== 'undefined' ? `${window.location.origin}/hemi-chess-logo.png` : 'https://hemichess.app/hemi-chess-logo.png',
    }),
  ],
  transports: {
    [hemiSepolia.id]: http('https://testnet.rpc.hemi.network/rpc'),
  },
  ssr: true,
  storage: customStorage,
  multiInjectedProviderDiscovery: true,
})

