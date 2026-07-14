"use client"

import { BreadUIKitProvider, ConnectedUserProvider } from "@breadcoop/ui"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { gnosis } from "wagmi/chains"
import { erc20Abi } from "viem"
import { wagmiConfig } from "../lib/wagmi"

const queryClient = new QueryClient()

// BREAD on Gnosis — only read by the kit's optional balance hook.
const BREAD_TOKEN = "0xa555d5344f6FB6c65da19e403Cb4c1eC4a1a5Ee3" as const

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BreadUIKitProvider
            app="fund"
            chainId={gnosis.id}
            authProvider="general"
            tokenConfig={{ BREAD: { address: BREAD_TOKEN, abi: erc20Abi } }}
          >
            <ConnectedUserProvider>{children}</ConnectedUserProvider>
          </BreadUIKitProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
