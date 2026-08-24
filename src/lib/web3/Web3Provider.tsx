import { WagmiProvider } from 'wagmi'
import { config } from './config'
import { type ReactNode } from 'react'
import { NotificationProvider } from '@/contexts/NotificationContext'

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </WagmiProvider>
  )
}
