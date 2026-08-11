import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'

// Define Hemi Sepolia testnet
export const hemiSepolia = defineChain({
  id: 743111,
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

// Create Wagmi config
export const wagmiConfig = createConfig({
  chains: [hemiSepolia],
  transports: {
    [hemiSepolia.id]: http(),
  },
})
