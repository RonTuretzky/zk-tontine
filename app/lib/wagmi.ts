import { createConfig, http } from "wagmi"
import { gnosis } from "wagmi/chains"
import { injected } from "wagmi/connectors"

// Injected-only connector — no WalletConnect project id required (the same
// minimal setup the Bread kit's own Storybook uses).
export const wagmiConfig = createConfig({
  chains: [gnosis],
  connectors: [injected()],
  transports: {
    [gnosis.id]: http("https://rpc.gnosischain.com"),
  },
})
