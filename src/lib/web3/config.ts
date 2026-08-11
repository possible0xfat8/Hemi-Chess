import { createStorage, http } from 'wagmi'
import { defineChain } from 'viem'
import { createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'

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
const projectId = import.meta.env['VITE_WALLET_CONNECT_PROJECT_ID'] as string | undefined || 'demo-project-id'

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

// Create wagmi config
export const config = createConfig({
  chains: [hemiSepolia], // Use hemiSepolia as primary chain
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({ 
      projectId,
      metadata: {
        name: 'HemiChess',
        description: 'Decentralized Chess on Hemi Network',
        url: 'https://hemichess.com',
        icons: ['https://hemichess.com/icon.png']
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [hemiSepolia.id]: http(),
  },
  ssr: true,
  storage: customStorage,
  multiInjectedProviderDiscovery: true,
})
